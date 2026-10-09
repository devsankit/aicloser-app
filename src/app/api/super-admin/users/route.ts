import { NextResponse } from "next/server";
import { randomBytes, scryptSync } from "node:crypto";

import { requireSessionRole } from "@/lib/api/require-session-role";
import { prisma } from "@/lib/prisma";
import { normalizePhone as normalizePhoneValue } from "@/lib/auth/normalize";

function hashPassword(password: string, salt: string) {
  return scryptSync(password, salt, 64).toString("hex");
}

function generateAgentCode(name: string) {
  const sanitized = name.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) || "AGENT";
  const hex = randomBytes(3).toString("hex").toUpperCase();
  return `GX-${sanitized}-${hex}`;
}

export async function GET() {
  const authorization = await requireSessionRole(["SUPER_ADMIN"]);
  if (!authorization.ok) return authorization.response;

  try {
    const [rawUsers, agentProfiles, tenants] = await Promise.all([
      prisma.appAuthUser.findMany({
        select: {
          id: true,
          displayName: true,
          email: true,
          phone: true,
          role: true,
          assignedRole: true,
          tenantId: true,
          packageName: true,
          packageStatus: true,
          packageExpiresAt: true,
          createdAt: true,
          lastLoginAt: true,
          isSeeded: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.salesAgentProfile.findMany({
        select: {
          id: true,
          userId: true,
          agentCode: true,
          status: true,
          maxActiveLeads: true,
          permissions: true,
          createdAt: true,
        },
      }),
      prisma.tenant.findMany({
        select: {
          id: true,
          name: true,
          ownerUserId: true,
          editorSeatLimit: true,
        },
      }),
    ]);

    const subscriptions = rawUsers.length
      ? await prisma.userSubscription.findMany({
          where: { userId: { in: rawUsers.map((user) => user.id) } },
          orderBy: [{ createdAt: "desc" }, { updatedAt: "desc" }],
          include: { package: { select: { name: true, paymentRequired: true } } },
        })
      : [];
    const subscriptionMap = new Map<string, (typeof subscriptions)[number]>();
    for (const subscription of subscriptions) {
      if (!subscriptionMap.has(subscription.userId)) subscriptionMap.set(subscription.userId, subscription);
    }

    const agentMap = new Map<string, (typeof agentProfiles)[number]>();
    for (const agent of agentProfiles) {
      agentMap.set(agent.userId, agent);
    }

    const tenantMap = new Map<string, (typeof tenants)[number]>();
    for (const tenant of tenants) {
      if (tenant.id) tenantMap.set(tenant.id, tenant);
      if (tenant.ownerUserId) tenantMap.set(tenant.ownerUserId, tenant);
    }

    const users = rawUsers.map((user) => {
      const agent = agentMap.get(user.id);
      const tenant = user.tenantId ? tenantMap.get(user.tenantId) : tenantMap.get(user.id);
      const permissions = (agent?.permissions as Record<string, unknown> | null) ?? {};

      const seatLimit =
        typeof permissions.seatLimit === "number"
          ? permissions.seatLimit
          : typeof permissions.maxUsers === "number"
            ? permissions.maxUsers
            : typeof permissions.seats === "number"
              ? permissions.seats
              : tenant?.editorSeatLimit ?? 5;

      const companyName =
        (typeof permissions.companyName === "string" && permissions.companyName.trim()) ||
        tenant?.name ||
        (user.tenantId && user.tenantId !== "tenant-gigxomi" ? user.tenantId : "") ||
        "Personal Workspace";

      const effectiveRole =
        typeof permissions.workspaceRole === "string" && permissions.workspaceRole
          ? permissions.workspaceRole
          : user.assignedRole || user.role;

      const effectiveStatus = agent?.status ?? "ACTIVE";
      const subscription = subscriptionMap.get(user.id);
      const paymentStatus = subscription?.paymentStatus ?? (user.packageStatus === "ACTIVE" ? "PAID" : "NOT_CONFIGURED");
      const paymentPendingSince = subscription?.paymentStatus === "PENDING" ? subscription.createdAt.toISOString() : null;
      const activationLocked = subscription?.paymentStatus === "PENDING" && subscription.package.paymentRequired && subscription.createdAt.getTime() + 24 * 60 * 60 * 1000 <= Date.now();

      return {
        id: user.id,
        displayName: user.displayName,
        email: user.email || "",
        phone: user.phone || "",
        role: effectiveRole,
        companyName,
        status: effectiveStatus,
        seatLimit: Math.max(1, Number(seatLimit) || 5),
        agentCode: agent?.agentCode ?? null,
        agentProfileId: agent?.id ?? null,
        tenantId: user.tenantId,
        packageName: user.packageName || "Pro Workspace",
        paymentStatus,
        paymentPendingSince,
        activationLocked,
        createdAt: user.createdAt.toISOString(),
        lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
        isSeeded: user.isSeeded,
        isSuperAdmin: user.id === "user-super-admin" || user.role === "SUPER_ADMIN",
      };
    });

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    const stats = {
      totalUsers: users.length,
      activeUsers: users.filter((u) => u.status === "ACTIVE").length,
      totalSeats: users.reduce((sum, u) => sum + (u.seatLimit || 0), 0),
      newUsersToday: users.filter((u) => new Date(u.createdAt).getTime() >= startOfToday).length,
    };

    return NextResponse.json({ ok: true, users, stats });
  } catch (error) {
    console.error("Super Admin Users fetch failed:", error);
    return NextResponse.json({ ok: false, error: "Failed to load user list from database." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const authorization = await requireSessionRole(["SUPER_ADMIN"]);
  if (!authorization.ok) return authorization.response;

  try {
    const contentType = request.headers.get("content-type") || "";
    const wantsJson = contentType.includes("application/json") || (request.headers.get("accept") || "").includes("application/json");
    const body = (contentType.includes("application/json")
      ? await request.json().catch(() => null)
      : Object.fromEntries(await request.formData().catch(() => new FormData()))) as Record<string, unknown> | null;
    if (!body || typeof body.action !== "string") {
      return NextResponse.json({ ok: false, error: "Invalid request payload." }, { status: 400 });
    }

    const action = body.action;

    // --- ACTION 0: Payment status and activation state ---
    if (action === "update-payment-status") {
      const userId = String(body.userId ?? "").trim();
      const nextPaymentStatus = String(body.paymentStatus ?? "").toUpperCase();
      if (!userId || !["PENDING", "PAID"].includes(nextPaymentStatus)) {
        return NextResponse.json({ ok: false, error: "Valid user ID and payment status (PENDING or PAID) are required." }, { status: 400 });
      }

      const user = await prisma.appAuthUser.findUnique({ where: { id: userId } });
      if (!user) return NextResponse.json({ ok: false, error: "User not found." }, { status: 404 });
      let subscription = await prisma.userSubscription.findFirst({ where: { userId }, orderBy: [{ createdAt: "desc" }, { updatedAt: "desc" }] });
      if (!subscription) {
        const registrationPackage = await prisma.package.findFirst({
          where: { packageType: { in: ["AGENCY", "BOTH"] }, isActive: true, allowRegistration: true, paymentRequired: true },
          orderBy: [{ isRecommended: "desc" }, { sortOrder: "asc" }],
        });
        if (!registrationPackage) return NextResponse.json({ ok: false, error: "No active agency package is configured." }, { status: 409 });
        subscription = await prisma.userSubscription.create({
          data: {
            userId,
            packageId: registrationPackage.id,
            packageType: registrationPackage.packageType,
            billingType: registrationPackage.billingType,
            billingInterval: registrationPackage.billingInterval,
            amount: registrationPackage.amount,
            autoRenew: registrationPackage.autoRenewEnabled,
          },
        });
      }

      const packageRecord = await prisma.package.findUnique({ where: { id: subscription.packageId } });
      const paid = nextPaymentStatus === "PAID";
      const now = new Date();
      const updated = await prisma.userSubscription.update({
        where: { id: subscription.id },
        data: {
          paymentStatus: paid ? "PAID" : "PENDING",
          status: paid ? "ACTIVE" : "PENDING",
          ...(paid ? { startsAt: subscription.startsAt ?? now, expiresAt: new Date(now.getTime() + (packageRecord?.durationDays ?? 30) * 86400000) } : {}),
        },
      });
      await prisma.appAuthUser.update({ where: { id: userId }, data: { packageStatus: paid ? "ACTIVE" : "PAUSED", packageId: subscription.packageId, packageName: packageRecord?.name ?? user.packageName } });
      return NextResponse.json({ ok: true, userId, paymentStatus: updated.paymentStatus, activationLocked: !paid });
    }

    // --- ACTION 1: Quick Seat Scaling (+ / - / custom number) ---
    if (action === "update-seats") {
      const userId = String(body.userId ?? "").trim();
      const rawSeats = Number(body.seats);
      if (!userId || !Number.isFinite(rawSeats) || rawSeats < 1) {
        return NextResponse.json({ ok: false, error: "Valid User ID and seat count (>= 1) are required." }, { status: 400 });
      }
      const seats = Math.floor(rawSeats);

      const user = await prisma.appAuthUser.findUnique({ where: { id: userId } });
      if (!user) {
        return NextResponse.json({ ok: false, error: "User not found." }, { status: 404 });
      }

      const existingAgent = await prisma.salesAgentProfile.findFirst({ where: { userId } });
      if (existingAgent) {
        const prevPermissions = (existingAgent.permissions as Record<string, unknown> | null) ?? {};
        await prisma.salesAgentProfile.update({
          where: { id: existingAgent.id },
          data: {
            permissions: {
              ...prevPermissions,
              ...(user.role === "SUPER_ADMIN"
                ? { companyName: "Personal Workspace", workspaceRole: "SUPER_ADMIN", workspaceAdmin: true, isWorkspaceOwner: true }
                : {}),
              seatLimit: seats,
              maxUsers: seats,
              seats: seats,
            },
          },
        });
      } else {
        // Seeded platform-owner accounts predate the workspace-backed sales
        // profile. Give them an AICLOSER workspace before creating the profile
        // so the live schema's required tenantId is always satisfied.
        let tenantId = user.tenantId;
        if (!tenantId) {
          tenantId = `tenant-super-admin-${randomBytes(4).toString("hex")}`;
          await prisma.$executeRaw`
            INSERT INTO "AicloserWorkspace" (
              "id", "name", "slug", "ownerEmail", "ownerPhone", "status",
              "planTier", "maxSeats", "settings", "createdAt", "updatedAt"
            ) VALUES (
              ${tenantId}, ${`${user.displayName} Workspace`}, ${tenantId}, ${user.email || ""}, ${user.phone || ""},
              'ACTIVE', 'PRO', ${seats}, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            ) ON CONFLICT ("id") DO NOTHING
          `;
          await prisma.$executeRaw`
            UPDATE "AicloserWorkspace"
            SET "ownerUserId" = ${user.id}, "updatedAt" = CURRENT_TIMESTAMP
            WHERE "id" = ${tenantId}
          `;
          await prisma.appAuthUser.update({ where: { id: user.id }, data: { tenantId } });
        }
        await prisma.salesAgentProfile.create({
          data: {
            tenantId,
            userId,
            agentCode: generateAgentCode(user.displayName),
            status: "ACTIVE",
            maxActiveLeads: 50,
            permissions: {
              companyName: user.role === "SUPER_ADMIN" ? "Personal Workspace" : "Workspace",
              workspaceRole: user.role === "SUPER_ADMIN" ? "SUPER_ADMIN" : user.role === "ADMIN" ? "ADMIN" : "SALES_AGENT",
              workspaceAdmin: true,
              isWorkspaceOwner: true,
              seatLimit: seats,
              maxUsers: seats,
              seats: seats,
            },
          },
        });
      }

      if (user.tenantId && user.tenantId !== "tenant-gigxomi") {
        await prisma.tenant.updateMany({
          where: { id: user.tenantId },
          data: { editorSeatLimit: seats },
        });
        await prisma.$executeRaw`UPDATE "AicloserWorkspace" SET "maxSeats" = ${seats}, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = ${user.tenantId}`;
      }

      const response = { ok: true, userId, seatLimit: seats };
      return wantsJson
        ? NextResponse.json(response)
        : NextResponse.redirect(new URL("/super-admin?message=Seats+updated", request.url), 303);
    }

    // --- ACTION 2: Quick Status Toggle (ACTIVE / PENDING / SUSPENDED) ---
    if (action === "update-status") {
      const userId = String(body.userId ?? "").trim();
      const nextStatus = String(body.status ?? "").toUpperCase();
      if (!userId || !["ACTIVE", "PENDING", "SUSPENDED"].includes(nextStatus)) {
        return NextResponse.json({ ok: false, error: "Valid status (ACTIVE, PENDING, SUSPENDED) is required." }, { status: 400 });
      }

      const existingAgent = await prisma.salesAgentProfile.findFirst({ where: { userId } });
      if (existingAgent) {
        await prisma.salesAgentProfile.update({
          where: { id: existingAgent.id },
          data: { status: nextStatus as "ACTIVE" | "PENDING" | "SUSPENDED" },
        });
      } else {
        const user = await prisma.appAuthUser.findUnique({ where: { id: userId } });
        if (!user) return NextResponse.json({ ok: false, error: "User not found." }, { status: 404 });
        await prisma.salesAgentProfile.create({
          data: {
            userId,
            agentCode: generateAgentCode(user.displayName),
            status: nextStatus as "ACTIVE" | "PENDING" | "SUSPENDED",
            permissions: { seatLimit: 5, maxUsers: 5, workspaceAdmin: true },
          },
        });
      }

      return NextResponse.json({ ok: true, userId, status: nextStatus });
    }

    // --- ACTION 3: Add New User ---
    if (action === "create") {
      const displayName = String(body.displayName ?? "").trim();
      const email = String(body.email ?? "").trim().toLowerCase();
      const rawPhone = String(body.phone ?? "").trim();
      const phone = normalizePhoneValue(rawPhone) || rawPhone;
      const password = String(body.password ?? "").trim();
      const companyName = String(body.companyName ?? "").trim() || `${displayName}'s Agency`;
      const requestedRole = String(body.role ?? "SALES_AGENT").toUpperCase();
      const role = ["ADMIN", "MANAGER", "SALES_AGENT"].includes(requestedRole) ? requestedRole : "SALES_AGENT";
      const seatLimit = Math.max(1, Number(body.seats) || 5);
      const status = body.status === "PENDING" ? "PENDING" : "ACTIVE";

      if (!displayName || !email || !phone || !password) {
        return NextResponse.json({ ok: false, error: "Name, email, phone, and password are required." }, { status: 400 });
      }
      if (password.length < 6) {
        return NextResponse.json({ ok: false, error: "Password must be at least 6 characters." }, { status: 400 });
      }

      const duplicate = await prisma.appAuthUser.findFirst({
        where: {
          OR: [{ email }, { phone }, { loginPhoneAliases: { has: phone } }],
        },
      });
      if (duplicate) {
        return NextResponse.json({ ok: false, error: "A user with this email or phone already exists." }, { status: 409 });
      }

      const salt = randomBytes(16).toString("hex");
      const passwordHash = hashPassword(password, salt);
      const tenantId = `tenant-${randomBytes(4).toString("hex")}`;

      await prisma.$executeRaw`
        INSERT INTO "AicloserWorkspace" (
          "id", "name", "slug", "ownerEmail", "ownerPhone", "status", "planTier", "maxSeats", "settings", "createdAt", "updatedAt"
        ) VALUES (
          ${tenantId}, ${`${companyName} Workspace`}, ${tenantId}, ${email}, ${phone}, 'ACTIVE', 'PRO', ${seatLimit}, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        ) ON CONFLICT ("id") DO NOTHING
      `;

      const newUser = await prisma.appAuthUser.create({
        data: {
          id: `user-${role.toLowerCase().replace(/_/g, "-")}-${randomBytes(4).toString("hex")}`,
          role: role as any,
          assignedRole: role as any,
          tenantId,
          displayName,
          email,
          phone,
          loginPhoneAliases: [phone],
          packageName: "Pro Workspace",
          packageStatus: "ACTIVE",
          passwordSalt: salt,
          passwordHash,
          otpCode: "904290",
          permissions: [role.toLowerCase(), "closer_os"],
          isSeeded: false,
          createdByUserId: authorization.session.userId ?? null,
        },
      });

      const newAgent = await prisma.salesAgentProfile.create({
        data: {
          tenantId,
          userId: newUser.id,
          agentCode: generateAgentCode(displayName),
          status,
          maxActiveLeads: 50,
          permissions: {
            companyName,
            workspaceRole: role,
            workspaceAdmin: role === "ADMIN",
            isWorkspaceOwner: true,
            seatLimit,
            maxUsers: seatLimit,
            seats: seatLimit,
          },
        },
      });

      return NextResponse.json({
        ok: true,
        user: {
          id: newUser.id,
          displayName: newUser.displayName,
          email: newUser.email,
          phone: newUser.phone,
          role,
          companyName,
          status,
          seatLimit,
          agentCode: newAgent.agentCode,
          createdAt: newUser.createdAt.toISOString(),
          lastLoginAt: null,
          isSeeded: false,
          isSuperAdmin: false,
        },
      });
    }

    // --- ACTION 4: Update Existing User ---
    if (action === "update") {
      const userId = String(body.userId ?? "").trim();
      if (!userId) {
        return NextResponse.json({ ok: false, error: "User ID is required." }, { status: 400 });
      }

      const existingUser = await prisma.appAuthUser.findUnique({ where: { id: userId } });
      if (!existingUser) {
        return NextResponse.json({ ok: false, error: "User not found." }, { status: 404 });
      }

      const displayName = String(body.displayName ?? "").trim() || existingUser.displayName;
      const email = String(body.email ?? "").trim().toLowerCase() || existingUser.email;
      const rawPhone = String(body.phone ?? "").trim();
      const phone = rawPhone ? normalizePhoneValue(rawPhone) || rawPhone : existingUser.phone;
      const companyName = String(body.companyName ?? "").trim();
      const requestedRole = String(body.role ?? "").toUpperCase();
      const role = ["ADMIN", "MANAGER", "SALES_AGENT"].includes(requestedRole) ? requestedRole : existingUser.role;
      const seatLimit = body.seats ? Math.max(1, Number(body.seats) || 5) : undefined;
      const status = body.status ? (String(body.status).toUpperCase() as "ACTIVE" | "PENDING" | "SUSPENDED") : undefined;
      const password = String(body.password ?? "").trim();

      const updateData: Record<string, unknown> = {
        displayName,
        email,
        phone,
      };

      if (userId !== "user-super-admin" && role) {
        updateData.role = role;
        updateData.assignedRole = role;
      }

      if (password) {
        if (password.length < 6) {
          return NextResponse.json({ ok: false, error: "Password must be at least 6 characters." }, { status: 400 });
        }
        const salt = randomBytes(16).toString("hex");
        updateData.passwordSalt = salt;
        updateData.passwordHash = hashPassword(password, salt);
      }

      const updatedUser = await prisma.appAuthUser.update({
        where: { id: userId },
        data: updateData as any,
      });

      const existingAgent = await prisma.salesAgentProfile.findFirst({ where: { userId } });
      const prevPerms = (existingAgent?.permissions as Record<string, unknown> | null) ?? {};
      const newPerms = {
        ...prevPerms,
        ...(companyName ? { companyName } : {}),
        ...(seatLimit !== undefined ? { seatLimit, maxUsers: seatLimit, seats: seatLimit } : {}),
        ...(role ? { workspaceRole: role, workspaceAdmin: role === "ADMIN" } : {}),
      };

      if (existingAgent) {
        await prisma.salesAgentProfile.update({
          where: { id: existingAgent.id },
          data: {
            ...(status ? { status } : {}),
            permissions: newPerms,
          },
        });
      } else {
        await prisma.salesAgentProfile.create({
          data: {
            userId,
            agentCode: generateAgentCode(displayName),
            status: status ?? "ACTIVE",
            permissions: newPerms,
          },
        });
      }

      if (seatLimit !== undefined && updatedUser.tenantId && updatedUser.tenantId !== "tenant-gigxomi") {
        await prisma.tenant.updateMany({
          where: { id: updatedUser.tenantId },
          data: { editorSeatLimit: seatLimit },
        });
      }

      return NextResponse.json({ ok: true, user: updatedUser });
    }

    return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error) {
    console.error("Super Admin User operation failed:", error);
    return NextResponse.json({ ok: false, error: "Internal server error performing user operation." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const authorization = await requireSessionRole(["SUPER_ADMIN"]);
  if (!authorization.ok) return authorization.response;

  try {
    const { searchParams } = new URL(request.url);
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const userId = String(body?.userId ?? searchParams.get("userId") ?? "").trim();

    if (!userId) {
      return NextResponse.json({ ok: false, error: "User ID is required." }, { status: 400 });
    }

    if (userId === "user-super-admin") {
      return NextResponse.json({ ok: false, error: "Platform owner/Super Admin cannot be deleted." }, { status: 403 });
    }

    const user = await prisma.appAuthUser.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ ok: false, error: "User not found." }, { status: 404 });
    }

    if (user.role === "SUPER_ADMIN") {
      return NextResponse.json({ ok: false, error: "Super Admin accounts cannot be deleted." }, { status: 403 });
    }

    await prisma.$transaction([
      prisma.salesAgentProfile.deleteMany({ where: { userId } }),
      prisma.appAuthChallenge.deleteMany({ where: { userId } }),
      prisma.appPasswordResetToken.deleteMany({ where: { userId } }),
      prisma.appFreelancerWorkspace.deleteMany({ where: { userId } }),
      prisma.appFreelancerService.deleteMany({ where: { ownerId: userId } }),
      prisma.appAuthUser.delete({ where: { id: userId } }),
    ]);

    return NextResponse.json({ ok: true, deletedUserId: userId });
  } catch (error) {
    console.error("Super Admin user delete failed:", error);
    return NextResponse.json({ ok: false, error: "Failed to delete user." }, { status: 500 });
  }
}
