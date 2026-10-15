import { NextResponse } from "next/server";

import { requireSessionRole } from "@/lib/api/require-session-role";
import { ensureAffiliateProfile } from "@/lib/gigxomi/sales-store";
import { prisma } from "@/lib/prisma";

type JsonRecord = Record<string, unknown>;

type WorkspaceRow = {
  id: string;
  name: string | null;
  status: string | null;
  planTier: string | null;
  maxSeats: number | null;
  ownerUserId: string | null;
};

function numberFrom(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function profileSeats(permissions: unknown, fallback: number) {
  if (!permissions || typeof permissions !== "object" || Array.isArray(permissions)) return fallback;
  const record = permissions as JsonRecord;
  return Math.max(1, numberFrom(record.seatLimit ?? record.maxUsers ?? record.seats, fallback));
}

function isWorkspaceAdmin(permissions: unknown) {
  if (!permissions || typeof permissions !== "object" || Array.isArray(permissions)) return false;
  const record = permissions as JsonRecord;
  return record.workspaceAdmin === true || String(record.workspaceRole ?? "").toUpperCase() === "ADMIN";
}

function effectiveStatus(profileStatus: string | undefined, packageStatus: string | null) {
  if (profileStatus === "ACTIVE" || profileStatus === "PENDING" || profileStatus === "SUSPENDED") return profileStatus;
  if (packageStatus === "ACTIVE") return "ACTIVE";
  if (packageStatus === "PAUSED" || packageStatus === "EXPIRED") return "SUSPENDED";
  return "PENDING";
}

async function readDirectory() {
  const [rawUsers, profiles, tenants, subscriptions] = await Promise.all([
    prisma.appAuthUser.findMany({
      // Keep seeded demo records out, but include seeded accounts that are
      // linked to a real workspace so Super Admin can manage their plan,
      // seats, and active/suspended state.
      where: { role: { not: "SUPER_ADMIN" }, OR: [{ isSeeded: false }, { tenantId: { not: null } }] },
      select: {
        id: true,
        displayName: true,
        email: true,
        phone: true,
        role: true,
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
      select: { id: true, userId: true, agentCode: true, status: true, permissions: true },
    }),
    prisma.tenant.findMany({ select: { id: true, name: true, status: true, editorSeatLimit: true } }),
    prisma.userSubscription.findMany({
      orderBy: [{ createdAt: "desc" }, { updatedAt: "desc" }],
      include: { package: { select: { name: true } } },
    }),
  ]);

  let workspaces: WorkspaceRow[] = [];
  try {
    workspaces = await prisma.$queryRaw<WorkspaceRow[]>`
      SELECT "id", "name", "status", "planTier", "maxSeats", "ownerUserId"
      FROM "AicloserWorkspace"
    `;
  } catch {
    // Tenant records remain a safe fallback for older databases.
  }

  const profilesByUser = new Map(profiles.map((profile) => [profile.userId, profile]));
  const tenantsById = new Map(tenants.map((tenant) => [tenant.id, tenant]));
  const workspacesById = new Map(workspaces.map((workspace) => [workspace.id, workspace]));
  const subscriptionByUser = new Map<string, (typeof subscriptions)[number]>();
  for (const subscription of subscriptions) {
    if (!subscriptionByUser.has(subscription.userId)) subscriptionByUser.set(subscription.userId, subscription);
  }

  const users = rawUsers.map((user) => {
    const profile = profilesByUser.get(user.id);
    const subscription = subscriptionByUser.get(user.id);
    const tenant = user.tenantId ? tenantsById.get(user.tenantId) : undefined;
    const workspace = user.tenantId ? workspacesById.get(user.tenantId) : undefined;
    const seatLimit = profileSeats(profile?.permissions, workspace?.maxSeats ?? tenant?.editorSeatLimit ?? 1);
    const effectiveRole = isWorkspaceAdmin(profile?.permissions) ? "ADMIN" : user.role;
    const paymentStatus = subscription?.paymentStatus ?? (user.packageStatus === "ACTIVE" ? "PAID" : user.packageStatus ? "PENDING" : "NOT_CONFIGURED");

    return {
      id: user.id,
      displayName: user.displayName,
      email: user.email ?? "",
      phone: user.phone ?? "",
      role: effectiveRole,
      companyName: workspace?.name ?? tenant?.name ?? "Unassigned workspace",
      status: effectiveStatus(profile?.status, user.packageStatus),
      workspaceStatus: workspace?.status ?? tenant?.status ?? effectiveStatus(profile?.status, user.packageStatus),
      seatLimit,
      workspaceSeatLimit: workspace?.maxSeats ?? tenant?.editorSeatLimit ?? seatLimit,
      paymentStatus,
      paymentPendingSince: subscription?.createdAt?.toISOString() ?? null,
      activationLocked: user.packageStatus !== "ACTIVE" && paymentStatus !== "PAID",
      packageExpiresAt: subscription?.expiresAt?.toISOString() ?? user.packageExpiresAt?.toISOString() ?? null,
      agentCode: profile?.agentCode ?? null,
      agentProfileId: profile?.id ?? null,
      tenantId: user.tenantId,
      packageName: subscription?.package.name ?? user.packageName ?? workspace?.planTier ?? "Not configured",
      createdAt: user.createdAt.toISOString(),
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      isSeeded: user.isSeeded,
      isSuperAdmin: false,
    };
  });

  const workspaceSeats = new Map<string, number>();
  for (const user of users) {
    const key = user.tenantId || user.id;
    workspaceSeats.set(key, Math.max(workspaceSeats.get(key) ?? 0, user.workspaceSeatLimit));
  }

  const stats = {
    totalUsers: users.length,
    activeUsers: users.filter((user) => user.status === "ACTIVE").length,
    totalSeats: [...workspaceSeats.values()].reduce((total, seats) => total + seats, 0),
    newUsersToday: users.filter((user) => user.createdAt.slice(0, 10) === new Date().toISOString().slice(0, 10)).length,
  };

  return { users, stats };
}

async function findTargetUser(userId: string) {
  const user = await prisma.appAuthUser.findUnique({ where: { id: userId } });
  if (!user || user.role === "SUPER_ADMIN") throw new Error("Target user was not found or is protected.");
  return user;
}

async function updateSeats(userId: string, seats: number) {
  const user = await findTargetUser(userId);
  if (!user.tenantId) throw new Error("This account is not linked to a workspace; repair its tenant mapping before changing seats.");
  const safeSeats = Math.min(500, Math.max(1, Math.floor(seats)));
  const ensured = await ensureAffiliateProfile(user.id);
  const currentPermissions = ensured.profile.permissions && typeof ensured.profile.permissions === "object" && !Array.isArray(ensured.profile.permissions)
    ? (ensured.profile.permissions as JsonRecord)
    : {};

  await prisma.salesAgentProfile.update({
    where: { id: ensured.profile.id },
    data: { permissions: { ...currentPermissions, seatLimit: safeSeats, maxUsers: safeSeats, seats: safeSeats } },
  });
  if (user.tenantId) {
    await prisma.tenant.updateMany({ where: { id: user.tenantId }, data: { editorSeatLimit: safeSeats } });
    const updatedWorkspaceRows = await prisma.$executeRaw`
      UPDATE "AicloserWorkspace"
      SET "maxSeats" = ${safeSeats}, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${user.tenantId}
    `;
    if (updatedWorkspaceRows !== 1) {
      throw new Error("Workspace seat limit could not be persisted.");
    }
  }
  return safeSeats;
}

async function updateWorkspaceSeats(tenantId: string, seats: number) {
  const normalizedTenantId = tenantId.trim();
  if (!normalizedTenantId) throw new Error("Workspace is required.");
  const tenant = await prisma.tenant.findUnique({ where: { id: normalizedTenantId }, select: { id: true } });
  const workspaceRows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "AicloserWorkspace" WHERE "id" = ${normalizedTenantId} LIMIT 1
  `.catch(() => []);
  if (!tenant && !workspaceRows.length) throw new Error("Workspace was not found.");

  const safeSeats = Math.min(500, Math.max(1, Math.floor(seats)));
  if (tenant) await prisma.tenant.update({ where: { id: tenant.id }, data: { editorSeatLimit: safeSeats } });
  if (workspaceRows.length) {
    const updatedWorkspaceRows = await prisma.$executeRaw`
      UPDATE "AicloserWorkspace"
      SET "maxSeats" = ${safeSeats}, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${normalizedTenantId}
    `;
    if (updatedWorkspaceRows !== 1) {
      throw new Error("Workspace seat limit could not be persisted.");
    }
  }
  return safeSeats;
}

async function updateWorkspaceExpiry(tenantId: string, rawExpiry: unknown) {
  const normalizedTenantId = tenantId.trim();
  if (!normalizedTenantId) throw new Error("Workspace is required.");
  const tenant = await prisma.tenant.findUnique({ where: { id: normalizedTenantId }, select: { id: true } });
  const workspaceRows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "AicloserWorkspace" WHERE "id" = ${normalizedTenantId} LIMIT 1
  `.catch(() => []);
  if (!tenant && !workspaceRows.length) throw new Error("Workspace was not found.");

  const expiry = typeof rawExpiry === "string" && rawExpiry.trim() ? new Date(`${rawExpiry.trim()}T23:59:59.999Z`) : null;
  if (expiry && Number.isNaN(expiry.getTime())) throw new Error("Enter a valid expiry date.");

  const workspaceUsers = await prisma.appAuthUser.findMany({ where: { tenantId: normalizedTenantId }, select: { id: true } });
  const shouldReactivate = !expiry || expiry.getTime() > Date.now();
  await prisma.appAuthUser.updateMany({
    where: { tenantId: normalizedTenantId },
    data: {
      packageExpiresAt: expiry,
      ...(shouldReactivate ? { packageStatus: "ACTIVE" } : { packageStatus: "EXPIRED" }),
    },
  });
  if (workspaceUsers.length) {
    await prisma.userSubscription.updateMany({
      where: { userId: { in: workspaceUsers.map((user) => user.id) } },
      data: {
        expiresAt: expiry,
        ...(shouldReactivate ? { status: "ACTIVE", paymentStatus: "PAID" } : { status: "EXPIRED" }),
      },
    });
    if (shouldReactivate) {
      await prisma.salesAgentProfile.updateMany({ where: { userId: { in: workspaceUsers.map((user) => user.id) } }, data: { status: "ACTIVE" } });
    }
  }
  if (tenant) await prisma.tenant.update({ where: { id: normalizedTenantId }, data: { status: shouldReactivate ? "ACTIVE" : "SUSPENDED" } });
  if (workspaceRows.length) {
    await prisma.$executeRaw`UPDATE "AicloserWorkspace" SET "status" = ${shouldReactivate ? "ACTIVE" : "SUSPENDED"}, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = ${normalizedTenantId}`.catch(() => 0);
  }
  return expiry?.toISOString() ?? null;
}

async function updateWorkspaceStatus(tenantId: string, rawStatus: unknown) {
  const normalizedTenantId = tenantId.trim();
  if (!normalizedTenantId) throw new Error("Workspace is required.");
  const tenant = await prisma.tenant.findUnique({ where: { id: normalizedTenantId }, select: { id: true } });
  const workspaceRows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "AicloserWorkspace" WHERE "id" = ${normalizedTenantId} LIMIT 1
  `.catch(() => []);
  if (!tenant && !workspaceRows.length) throw new Error("Workspace was not found.");

  const status = String(rawStatus ?? "").toUpperCase();
  if (status !== "ACTIVE" && status !== "SUSPENDED") throw new Error("Workspace status must be ACTIVE or SUSPENDED.");
  const workspaceUsers = await prisma.appAuthUser.findMany({ where: { tenantId: normalizedTenantId }, select: { id: true } });
  if (tenant) await prisma.tenant.update({ where: { id: tenant.id }, data: { status: status as "ACTIVE" | "SUSPENDED" } });
  await prisma.$executeRaw`UPDATE "AicloserWorkspace" SET "status" = ${status}, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = ${normalizedTenantId}`.catch(() => 0);
  if (workspaceUsers.length) {
    await prisma.salesAgentProfile.updateMany({ where: { userId: { in: workspaceUsers.map((user) => user.id) } }, data: { status: status as "ACTIVE" | "SUSPENDED" } });
  }
  return status;
}

async function updateExpiry(userId: string, rawExpiry: unknown) {
  const user = await findTargetUser(userId);
  const expiry = typeof rawExpiry === "string" && rawExpiry.trim() ? new Date(`${rawExpiry.trim()}T23:59:59.999Z`) : null;
  if (expiry && Number.isNaN(expiry.getTime())) throw new Error("Enter a valid expiry date.");

  const shouldReactivate = !expiry || expiry.getTime() > Date.now();
  await prisma.appAuthUser.update({ where: { id: user.id }, data: { packageExpiresAt: expiry, packageStatus: shouldReactivate ? "ACTIVE" : "EXPIRED" } });
  const subscription = await prisma.userSubscription.findFirst({ where: { userId: user.id }, orderBy: { updatedAt: "desc" } });
  if (subscription) {
    await prisma.userSubscription.update({
      where: { id: subscription.id },
      data: { expiresAt: expiry, ...(shouldReactivate ? { status: "ACTIVE", paymentStatus: "PAID" } : { status: "EXPIRED" }) },
    });
  }
  if (shouldReactivate) {
    const ensured = await ensureAffiliateProfile(user.id);
    await prisma.salesAgentProfile.update({ where: { id: ensured.profile.id }, data: { status: "ACTIVE" } });
  }
  return expiry?.toISOString() ?? null;
}

export async function GET() {
  const authorization = await requireSessionRole(["SUPER_ADMIN"]);
  if (!authorization.ok) return authorization.response;

  try {
    return NextResponse.json({ ok: true, ...(await readDirectory()) });
  } catch (error) {
    console.error("Super Admin user directory fetch failed:", error);
    return NextResponse.json({ ok: false, error: "Failed to load the user directory." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const authorization = await requireSessionRole(["SUPER_ADMIN"]);
  if (!authorization.ok) return authorization.response;

  try {
    const body = (await request.json()) as JsonRecord;
    const action = String(body.action ?? "");
    const userId = String(body.userId ?? "").trim();

    if (action === "update-seats") {
      const seatLimit = await updateSeats(userId, numberFrom(body.seats, 1));
      return NextResponse.json({ ok: true, seatLimit });
    }

    if (action === "update-workspace-seats") {
      const seatLimit = await updateWorkspaceSeats(String(body.tenantId ?? ""), numberFrom(body.seats, 1));
      return NextResponse.json({ ok: true, seatLimit });
    }

    if (action === "update-workspace-expiry") {
      const packageExpiresAt = await updateWorkspaceExpiry(String(body.tenantId ?? ""), body.packageExpiresAt);
      return NextResponse.json({ ok: true, packageExpiresAt });
    }

    if (action === "update-workspace-status") {
      const status = await updateWorkspaceStatus(String(body.tenantId ?? ""), body.status);
      return NextResponse.json({ ok: true, status });
    }

    if (!userId) return NextResponse.json({ ok: false, error: "User is required." }, { status: 400 });

    if (action === "update-expiry") {
      const packageExpiresAt = await updateExpiry(userId, body.packageExpiresAt);
      return NextResponse.json({ ok: true, packageExpiresAt });
    }

    if (action === "update-status") {
      const user = await findTargetUser(userId);
      if (!user.tenantId) throw new Error("This account is not linked to a workspace; repair its tenant mapping before changing status.");
      const status = String(body.status ?? "").toUpperCase();
      if (!["ACTIVE", "PENDING", "SUSPENDED"].includes(status)) throw new Error("Invalid account status.");
      const ensured = await ensureAffiliateProfile(user.id);
      await prisma.salesAgentProfile.update({ where: { id: ensured.profile.id }, data: { status: status as "ACTIVE" | "PENDING" | "SUSPENDED" } });
      return NextResponse.json({ ok: true, status });
    }

    if (action === "update-payment-status") {
      const user = await findTargetUser(userId);
      const paymentStatus = String(body.paymentStatus ?? "").toUpperCase();
      if (!["PENDING", "PAID"].includes(paymentStatus)) throw new Error("Invalid payment status.");
      await prisma.appAuthUser.update({ where: { id: user.id }, data: { packageStatus: paymentStatus === "PAID" ? "ACTIVE" : "PAUSED" } });
      const subscription = await prisma.userSubscription.findFirst({ where: { userId: user.id }, orderBy: { updatedAt: "desc" } });
      if (subscription) {
        await prisma.userSubscription.update({
          where: { id: subscription.id },
          data: { paymentStatus: paymentStatus as "PENDING" | "PAID", status: paymentStatus === "PAID" ? "ACTIVE" : "PAUSED" },
        });
      }
      return NextResponse.json({ ok: true, paymentStatus });
    }

    if (action === "update") {
      const user = await findTargetUser(userId);
      if (body.packageExpiresAt !== undefined) await updateExpiry(user.id, body.packageExpiresAt);
      if (body.seats !== undefined) await updateSeats(user.id, numberFrom(body.seats, 1));
      if (body.status !== undefined) {
        const status = String(body.status).toUpperCase();
        if (!["ACTIVE", "PENDING", "SUSPENDED"].includes(status)) throw new Error("Invalid account status.");
        if (!user.tenantId) throw new Error("This account is not linked to a workspace; repair its tenant mapping before changing status.");
        const ensured = await ensureAffiliateProfile(user.id);
        await prisma.salesAgentProfile.update({ where: { id: ensured.profile.id }, data: { status: status as "ACTIVE" | "PENDING" | "SUSPENDED" } });
      }
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: false, error: "Unsupported Super Admin action." }, { status: 400 });
  } catch (error) {
    console.error("Super Admin user operation failed:", error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "The operation could not be completed." }, { status: 400 });
  }
}
