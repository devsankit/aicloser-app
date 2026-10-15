import { NextResponse } from "next/server";

import { requireSessionRole } from "@/lib/api/require-session-role";
import { getSalesSnapshotForRole } from "@/lib/gigxomi/sales-store";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const authorization = await requireSessionRole(["SUPER_ADMIN", "ADMIN", "SALES_AGENT"]);
  if (!authorization.ok) return authorization.response;

  try {
    const snapshot = await getSalesSnapshotForRole(authorization.session);
    const isWorkspaceAdmin =
      authorization.session.role === "SUPER_ADMIN" ||
      authorization.session.role === "ADMIN" ||
      Boolean(snapshot.currentAgent?.permissions && typeof snapshot.currentAgent.permissions === "object" && (snapshot.currentAgent.permissions as Record<string, unknown>).workspaceAdmin);
    if (!isWorkspaceAdmin) {
      return NextResponse.json({ ok: false, error: "Workspace administrator access is required." }, { status: 403 });
    }
    const packageRecord = authorization.session.packageId
      ? await prisma.package.findUnique({
          where: { id: authorization.session.packageId },
          select: {
            name: true,
            teamMemberLimit: true,
            staffAccountLimit: true,
            whatsappIntegration: true,
            aiToolsAccess: true,
            automationTools: true,
            analyticsAccess: true,
            apiAccess: true,
            webhookAccess: true,
          },
        })
      : null;

    const ownerPermissions =
      snapshot.currentAgent?.permissions && typeof snapshot.currentAgent.permissions === "object"
        ? (snapshot.currentAgent.permissions as Record<string, unknown>)
        : null;
    const customSeatLimit =
      typeof ownerPermissions?.seatLimit === "number" && ownerPermissions.seatLimit > 0
        ? ownerPermissions.seatLimit
        : typeof ownerPermissions?.maxUsers === "number" && ownerPermissions.maxUsers > 0
          ? ownerPermissions.maxUsers
          : typeof ownerPermissions?.seats === "number" && ownerPermissions.seats > 0
            ? ownerPermissions.seats
            : null;

    // Super Admin seat controls persist the canonical limit on AicloserWorkspace.
    // Read that value first so Team & Users and Super Admin cannot drift apart.
    const workspaceSeatRows = await prisma.$queryRaw<{ maxSeats: number | null }[]>`
      SELECT "maxSeats" FROM "AicloserWorkspace" WHERE "id" = ${authorization.session.tenantId} LIMIT 1
    `.catch(() => []);
    const workspaceSeatLimit = workspaceSeatRows[0]?.maxSeats && workspaceSeatRows[0].maxSeats > 0
      ? workspaceSeatRows[0].maxSeats
      : null;

    const users = snapshot.agents ?? [];
    const activeUsers = users.filter((user) => user.status === "ACTIVE").length;
    const planCounts = users.reduce<Record<string, number>>((counts, user) => {
      const planName = user.packageName || "Free plan";
      counts[planName] = (counts[planName] ?? 0) + 1;
      return counts;
    }, {});

    return NextResponse.json({
      ok: true,
      plan: {
        name: packageRecord?.name || authorization.session.packageName || snapshot.currentAgent?.packageName || "Free plan",
        status: authorization.session.packageStatus || snapshot.currentAgent?.packageStatus || "ACTIVE",
        expiresAt: authorization.session.packageExpiresAt || snapshot.currentAgent?.packageExpiresAt || null,
        seatLimit: workspaceSeatLimit ?? customSeatLimit ?? packageRecord?.teamMemberLimit ?? packageRecord?.staffAccountLimit ?? 1,
        isUnlimited: workspaceSeatLimit === null && customSeatLimit === null && packageRecord?.teamMemberLimit === null && packageRecord?.staffAccountLimit === null,
      },
      usage: { totalUsers: users.length, activeUsers, planCounts },
      entitlements: {
        whatsappIntegration: packageRecord?.whatsappIntegration ?? false,
        aiToolsAccess: packageRecord?.aiToolsAccess ?? false,
        automationTools: packageRecord?.automationTools ?? false,
        analyticsAccess: packageRecord?.analyticsAccess ?? false,
        apiAccess: packageRecord?.apiAccess ?? false,
        webhookAccess: packageRecord?.webhookAccess ?? false,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unable to load workspace plan." },
      { status: 500 },
    );
  }
}
