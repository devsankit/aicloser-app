import { NextResponse } from "next/server";

import { requireSessionRole } from "@/lib/api/require-session-role";
import { prisma } from "@/lib/prisma";
import {
  createSalesAgentAccount,
  deleteSalesAgentFromAdmin,
  getSalesAgentAccess,
  getSalesSnapshotForRole,
  resetSalesAgentPasswordFromAdmin,
  updateSalesAgentProfile,
  type SalesAgentStatus,
} from "@/lib/gigxomi/sales-store";

export type WorkspaceUserRole = "ADMIN" | "MANAGER" | "SALES_AGENT";

function resolveAgentRole(permissions: Record<string, unknown> | null): WorkspaceUserRole {
  if (!permissions) return "SALES_AGENT";
  const explicit = String(permissions.workspaceRole ?? "").toUpperCase();
  if (explicit === "ADMIN" || explicit === "MANAGER" || explicit === "SALES_AGENT") {
    return explicit as WorkspaceUserRole;
  }
  if (Boolean(permissions.workspaceAdmin)) {
    return "ADMIN";
  }
  return "SALES_AGENT";
}

async function requireWorkspaceAdmin() {
  const authorization = await requireSessionRole(["SUPER_ADMIN", "ADMIN", "MANAGER", "SALES_AGENT"]);
  if (!authorization.ok) return authorization;

  if (authorization.session.role === "SUPER_ADMIN" || authorization.session.role === "ADMIN") {
    return authorization;
  }

  const access = await getSalesAgentAccess(authorization.session.userId);
  const permissions = access.agent?.permissions as Record<string, unknown> | null | undefined;
  const isProfileWorkspaceAdmin =
    permissions?.workspaceAdmin === true ||
    String(permissions?.workspaceRole ?? "").toUpperCase() === "ADMIN";

  if (access.ok && isProfileWorkspaceAdmin) return authorization;

  return {
    ok: false as const,
    response: NextResponse.json(
      { ok: false, error: "Only the workspace owner or an Admin can manage team users." },
      { status: 403 },
    ),
  };
}

export async function GET() {
  const authorization = await requireWorkspaceAdmin();
  if (!authorization.ok) return authorization.response;

  const snapshot = await getSalesSnapshotForRole(authorization.session);
  const agents = (snapshot.agents?.length ? snapshot.agents : snapshot.visibleAgents).map((agent) => ({
    id: agent.id,
    userId: agent.userId,
    displayName: agent.displayName,
    email: agent.email,
    phone: agent.phone,
    agentCode: agent.agentCode,
    status: agent.status,
    role: resolveAgentRole(agent.permissions),
    packageName: agent.packageName || "Free plan",
    packageStatus: agent.packageStatus || "ACTIVE",
    packageExpiresAt: agent.packageExpiresAt,
    canCreateSubAgents: agent.canCreateSubAgents,
    canClaimLeads: agent.canClaimLeads,
    groupId: agent.groupId,
    parentAgentId: agent.parentAgentId,
    createdAt: agent.createdAt,
  }));

  return NextResponse.json({ ok: true, users: agents });
}

export async function POST(request: Request) {
  const authorization = await requireWorkspaceAdmin();
  if (!authorization.ok) return authorization.response;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ ok: false, error: "Invalid request payload." }, { status: 400 });
  }

  const displayName = String(body.displayName ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const phone = String(body.phone ?? "").trim() || "+919000000000";
  const password = String(body.password ?? "").trim();
  const roleInput = String(body.role ?? "SALES_AGENT").toUpperCase();
  const role: WorkspaceUserRole =
    roleInput === "ADMIN" || roleInput === "MANAGER" ? (roleInput as WorkspaceUserRole) : "SALES_AGENT";
  const requestedManagerId = String(body.managerAgentId ?? "").trim();

  if (!displayName || !email) {
    return NextResponse.json({ ok: false, error: "Full name and Email ID are required." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ ok: false, error: "Password must be at least 8 characters." }, { status: 400 });
  }

  const snapshot = await getSalesSnapshotForRole(authorization.session);
  const activeUsers = snapshot.agents.filter((agent) => agent.status === "ACTIVE").length;
  const packageRecord = authorization.session.packageId
    ? await prisma.package.findUnique({
        where: { id: authorization.session.packageId },
        select: { teamMemberLimit: true, staffAccountLimit: true, name: true },
      })
    : null;
  const seatLimit = packageRecord?.teamMemberLimit ?? packageRecord?.staffAccountLimit ?? 1;
  if (seatLimit !== null && activeUsers >= seatLimit) {
    return NextResponse.json(
      {
        ok: false,
        error: `${packageRecord?.name || authorization.session.packageName || "Your current plan"} allows ${seatLimit} active user${seatLimit === 1 ? "" : "s"}. Upgrade the plan before adding another user.`,
      },
      { status: 409 },
    );
  }
  const manager = requestedManagerId
    ? snapshot.agents.find((agent) => agent.id === requestedManagerId)
    : null;

  if (requestedManagerId && (!manager || manager.status !== "ACTIVE" || resolveAgentRole(manager.permissions) !== "MANAGER")) {
    return NextResponse.json({ ok: false, error: "Choose an active manager from this workspace." }, { status: 400 });
  }

  if (requestedManagerId && role !== "SALES_AGENT") {
    return NextResponse.json({ ok: false, error: "Only sales agents can be placed under a manager." }, { status: 400 });
  }

  const created = await createSalesAgentAccount({
    displayName,
    email,
    phone,
    password,
    createdByUserId: authorization.session.userId ?? undefined,
    tenantId: authorization.session.tenantId,
    status: "ACTIVE",
    groupId: manager?.groupId || (snapshot.groups[0]?.id ?? "sales-group-main"),
    parentAgentId: manager?.id ?? null,
    canCreateSubAgents: role === "ADMIN" || role === "MANAGER",
    canClaimLeads: true,
    maxActiveLeads: 25,
  });

  if (!created.ok) {
    return NextResponse.json(created, { status: 400 });
  }

  const updatedAgent = await updateSalesAgentProfile({
    agentId: created.agent.id,
    status: "ACTIVE",
    canCreateSubAgents: role === "ADMIN" || role === "MANAGER",
    permissions: {
      ...(created.agent.permissions ?? {}),
      workspaceRole: role,
      workspaceAdmin: role === "ADMIN",
    },
  });

  return NextResponse.json({
    ok: true,
    user: {
      id: updatedAgent.id,
      userId: updatedAgent.userId,
      displayName: updatedAgent.displayName,
      email: updatedAgent.email,
      phone: updatedAgent.phone,
      agentCode: updatedAgent.agentCode,
      status: updatedAgent.status,
      role: resolveAgentRole(updatedAgent.permissions),
      packageName: updatedAgent.packageName || "Free plan",
      packageStatus: updatedAgent.packageStatus || "ACTIVE",
      packageExpiresAt: updatedAgent.packageExpiresAt,
    },
  });
}

export async function PATCH(request: Request) {
  const authorization = await requireWorkspaceAdmin();
  if (!authorization.ok) return authorization.response;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const agentId = String(body?.agentId ?? "").trim();
  if (!agentId) {
    return NextResponse.json({ ok: false, error: "User ID is required." }, { status: 400 });
  }

  if (body?.password) {
    const newPassword = String(body.password).trim();
    const res = await resetSalesAgentPasswordFromAdmin({ agentId, password: newPassword });
    if (!res.ok) {
      return NextResponse.json(res, { status: 400 });
    }
  }

  if (body?.role || body?.status) {
    const snapshot = await getSalesSnapshotForRole(authorization.session);
    const existing = (snapshot.agents?.length ? snapshot.agents : snapshot.visibleAgents).find((a) => a.id === agentId);
    const nextRoleInput = body.role ? String(body.role).toUpperCase() : resolveAgentRole(existing?.permissions ?? null);
    const nextRole: WorkspaceUserRole =
      nextRoleInput === "ADMIN" || nextRoleInput === "MANAGER" ? (nextRoleInput as WorkspaceUserRole) : "SALES_AGENT";
    const nextStatus = body.status ? (String(body.status).toUpperCase() as SalesAgentStatus) : existing?.status;

    await updateSalesAgentProfile({
      agentId,
      status: nextStatus,
      canCreateSubAgents: nextRole === "ADMIN" || nextRole === "MANAGER",
      permissions: {
        ...(existing?.permissions ?? {}),
        workspaceRole: nextRole,
        workspaceAdmin: nextRole === "ADMIN",
      },
    });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const authorization = await requireWorkspaceAdmin();
  if (!authorization.ok) return authorization.response;

  const { searchParams } = new URL(request.url);
  const agentId = String(searchParams.get("agentId") ?? "").trim();
  if (!agentId) {
    return NextResponse.json({ ok: false, error: "User ID is required." }, { status: 400 });
  }

  const deleted = await deleteSalesAgentFromAdmin({ agentId });
  if (!deleted.ok) {
    return NextResponse.json(deleted, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
