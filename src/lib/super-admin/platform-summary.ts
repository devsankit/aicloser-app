import { prisma } from "@/lib/prisma";

export type SuperAdminBusinessSummary = {
  tenantId: string;
  businessName: string;
  adminName: string;
  adminEmail: string;
  packageName: string;
  packageStatus: string;
  packageExpiresAt: string | null;
  workspaceStatus: string;
  totalTeamUsers: number;
  activeUsers: number;
  pendingUsers: number;
  suspendedUsers: number;
  allocatedSeats: number;
};

export type SuperAdminPlatformStats = {
  totalBusinesses: number;
  totalTeamUsers: number;
  activeUsers: number;
  pendingUsers: number;
  suspendedUsers: number;
  allocatedSeats: number;
  newSignupsToday: number;
};

export type SuperAdminPlatformSummary = {
  businesses: SuperAdminBusinessSummary[];
  stats: SuperAdminPlatformStats;
};

type WorkspaceRow = {
  id: string;
  name: string | null;
  status: string | null;
  planTier: string | null;
  maxSeats: number | null;
  ownerUserId: string | null;
};

function userState(user: { id: string; role: string; packageStatus: string | null }, agentStatus?: string) {
  const status = agentStatus || (user.packageStatus === "ACTIVE" ? "ACTIVE" : user.packageStatus === "PAUSED" || user.packageStatus === "EXPIRED" ? "SUSPENDED" : "PENDING");
  return status === "ACTIVE" || status === "PENDING" || status === "SUSPENDED" ? status : "PENDING";
}

export async function getSuperAdminPlatformSummary(): Promise<SuperAdminPlatformSummary> {
  const [rawUsers, agentProfiles, tenants, subscriptions] = await Promise.all([
    prisma.appAuthUser.findMany({
      where: { role: { not: "SUPER_ADMIN" }, tenantId: { not: null } },
      select: {
        id: true,
        displayName: true,
        email: true,
        role: true,
        tenantId: true,
        packageName: true,
        packageStatus: true,
        packageExpiresAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.salesAgentProfile.findMany({
      select: { userId: true, status: true, permissions: true },
    }),
    prisma.tenant.findMany({
      select: { id: true, name: true, ownerUserId: true, status: true, editorSeatLimit: true },
    }),
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
    // Older local databases may not have the workspace table yet. The Prisma
    // tenant records still provide a safe summary fallback.
    workspaces = [];
  }

  const usersByTenant = new Map<string, typeof rawUsers>();
  for (const user of rawUsers) {
    const tenantId = user.tenantId?.trim();
    if (!tenantId) continue;
    const users = usersByTenant.get(tenantId) || [];
    users.push(user);
    usersByTenant.set(tenantId, users);
  }

  const profileByUserId = new Map(agentProfiles.map((profile) => [profile.userId, profile]));
  const tenantById = new Map(tenants.map((tenant) => [tenant.id, tenant]));
  const workspaceById = new Map(workspaces.map((workspace) => [workspace.id, workspace]));
  const subscriptionByUserId = new Map<string, (typeof subscriptions)[number]>();
  for (const subscription of subscriptions) {
    if (!subscriptionByUserId.has(subscription.userId)) subscriptionByUserId.set(subscription.userId, subscription);
  }

  const tenantIds = new Set([...usersByTenant.keys(), ...workspaces.map((workspace) => workspace.id), ...tenants.map((tenant) => tenant.id)]);
  const businesses = [...tenantIds].map((tenantId): SuperAdminBusinessSummary => {
    const users = usersByTenant.get(tenantId) || [];
    const workspace = workspaceById.get(tenantId);
    const tenant = tenantById.get(tenantId);
    const ownerId = workspace?.ownerUserId || tenant?.ownerUserId;
    const admin = users.find((user) => user.id === ownerId) || users.find((user) => user.role === "ADMIN") || users[0];
    const subscription = admin ? subscriptionByUserId.get(admin.id) : undefined;
    const statuses = users.map((user) => userState(user, profileByUserId.get(user.id)?.status));
    const seatPermission = admin ? (profileByUserId.get(admin.id)?.permissions as Record<string, unknown> | null) : null;
    const permissionSeats = Number(seatPermission?.seatLimit || seatPermission?.maxUsers || seatPermission?.seats || 0);
    const allocatedSeats = Math.max(0, Number(workspace?.maxSeats || tenant?.editorSeatLimit || permissionSeats || 0));

    return {
      tenantId,
      businessName: workspace?.name || tenant?.name || `${admin?.displayName || "Business"} Workspace`,
      adminName: admin?.displayName || workspace?.ownerUserId || "Admin not assigned",
      adminEmail: admin?.email || "",
      packageName: subscription?.package.name || admin?.packageName || workspace?.planTier || "Not configured",
      packageStatus: subscription?.status || admin?.packageStatus || "NOT_CONFIGURED",
      packageExpiresAt: subscription?.expiresAt?.toISOString() || admin?.packageExpiresAt?.toISOString() || null,
      workspaceStatus: workspace?.status || tenant?.status || "ACTIVE",
      totalTeamUsers: users.length,
      activeUsers: statuses.filter((status) => status === "ACTIVE").length,
      pendingUsers: statuses.filter((status) => status === "PENDING").length,
      suspendedUsers: statuses.filter((status) => status === "SUSPENDED").length,
      allocatedSeats,
    };
  }).sort((left, right) => left.businessName.localeCompare(right.businessName));

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const stats = businesses.reduce<SuperAdminPlatformStats>((summary, business) => ({
    ...summary,
    totalTeamUsers: summary.totalTeamUsers + business.totalTeamUsers,
    activeUsers: summary.activeUsers + business.activeUsers,
    pendingUsers: summary.pendingUsers + business.pendingUsers,
    suspendedUsers: summary.suspendedUsers + business.suspendedUsers,
    allocatedSeats: summary.allocatedSeats + business.allocatedSeats,
  }), {
    totalBusinesses: businesses.length,
    totalTeamUsers: 0,
    activeUsers: 0,
    pendingUsers: 0,
    suspendedUsers: 0,
    allocatedSeats: 0,
    newSignupsToday: rawUsers.filter((user) => user.createdAt >= startOfToday).length,
  });

  return { businesses, stats };
}
