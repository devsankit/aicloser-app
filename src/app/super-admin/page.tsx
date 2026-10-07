import type { Metadata } from "next";

import { SuperAdminCloserControl, type SuperAdminUser, type SuperAdminStats } from "@/components/super-admin/super-admin-closer-control";
import { requirePageRole } from "@/lib/auth/page-guard";
import { getSessionContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Super Admin Command Center | AI Closer",
  robots: { index: false, follow: false },
};

export default async function SuperAdminPage() {
  const session = await requirePageRole(["SUPER_ADMIN"], "/super-admin");

  let users: SuperAdminUser[] = [];
  let stats: SuperAdminStats = {
    totalUsers: 0,
    activeUsers: 0,
    totalSeats: 0,
    newUsersToday: 0,
  };

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

    const agentMap = new Map<string, (typeof agentProfiles)[number]>();
    for (const agent of agentProfiles) {
      agentMap.set(agent.userId, agent);
    }

    const tenantMap = new Map<string, (typeof tenants)[number]>();
    for (const tenant of tenants) {
      if (tenant.id) tenantMap.set(tenant.id, tenant);
      if (tenant.ownerUserId) tenantMap.set(tenant.ownerUserId, tenant);
    }

    users = rawUsers.map((user) => {
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
        createdAt: user.createdAt.toISOString(),
        lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
        isSeeded: user.isSeeded,
        isSuperAdmin: user.id === "user-super-admin" || user.role === "SUPER_ADMIN",
      };
    });

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    stats = {
      totalUsers: users.length,
      activeUsers: users.filter((u) => u.status === "ACTIVE").length,
      totalSeats: users.reduce((sum, u) => sum + (u.seatLimit || 0), 0),
      newUsersToday: users.filter((u) => new Date(u.createdAt).getTime() >= startOfToday).length,
    };
  } catch (error) {
    console.error("Failed to load super-admin user directory.", error);
  }

  return (
    <SuperAdminCloserControl
      adminUser={{
        displayName: session.displayName,
        email: session.email,
        role: session.role,
      }}
      initialUsers={users}
      initialStats={stats}
    />
  );
}
