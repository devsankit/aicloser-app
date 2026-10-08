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

export type WorkspaceUserRole = "UNASSIGNED" | "ADMIN" | "MANAGER" | "SALES_AGENT";

function resolveAgentRole(permissions: Record<string, unknown> | null): WorkspaceUserRole {
  if (!permissions) return "SALES_AGENT";
  const explicit = String(permissions.workspaceRole ?? "").toUpperCase();
  if (explicit === "UNASSIGNED" || explicit === "ADMIN" || explicit === "MANAGER" || explicit === "SALES_AGENT") {
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
  const phone = String(body.phone ?? "").trim();
  const password = String(body.password ?? "").trim();

  if (!displayName || !email) {
    return NextResponse.json({ ok: false, error: "Full name and Email ID are required." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ ok: false, error: "Password must be at least 8 characters." }, { status: 400 });
  }

  const snapshot = await getSalesSnapshotForRole(authorization.session);
  const activeUsers = snapshot.agents.filter((agent) => agent.status === "ACTIVE").length;
  const ownerAccess = await getSalesAgentAccess(authorization.session.userId);
  const permissions = ownerAccess.agent?.permissions as Record<string, unknown> | null | undefined;
  const customSeats =
    typeof permissions?.seatLimit === "number"
      ? permissions.seatLimit
      : typeof permissions?.maxUsers === "number"
        ? permissions.maxUsers
        : typeof permissions?.seats === "number"
          ? permissions.seats
          : null;

  const packageRecord = authorization.session.packageId
    ? await prisma.package.findUnique({
        where: { id: authorization.session.packageId },
        select: { teamMemberLimit: true, staffAccountLimit: true, name: true },
      })
    : null;
  const seatLimit = customSeats ?? packageRecord?.teamMemberLimit ?? packageRecord?.staffAccountLimit ?? 5;
  if (seatLimit !== null && activeUsers >= seatLimit) {
    return NextResponse.json(
      {
        ok: false,
        error: `Your workspace allows ${seatLimit} active user${seatLimit === 1 ? "" : "s"}. Contact platform administrator to increase your seat limit.`,
      },
      { status: 409 },
    );
  }
  let createdAgentId: string | null = null;
  try {
    const created = await createSalesAgentAccount({
      displayName,
      email,
      phone,
      password,
      createdByUserId: authorization.session.userId ?? undefined,
      tenantId: authorization.session.tenantId,
      status: "PENDING",
      groupId: snapshot.groups[0]?.id ?? "sales-group-main",
      parentAgentId: null,
      canCreateSubAgents: false,
      canClaimLeads: true,
      maxActiveLeads: 25,
    });

    if (!created.ok) {
      return NextResponse.json(created, { status: 400 });
    }
    createdAgentId = created.agent.id;

    const updatedAgent = await updateSalesAgentProfile({
      agentId: created.agent.id,
      status: "PENDING",
      canCreateSubAgents: false,
      permissions: {
        ...(created.agent.permissions ?? {}),
        workspaceRole: "UNASSIGNED",
        workspaceAdmin: false,
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
  } catch (error) {
    if (createdAgentId) {
      await deleteSalesAgentFromAdmin({ agentId: createdAgentId }).catch(() => undefined);
    }
    const message = error instanceof Error ? error.message : "Unable to create user account.";
    console.error("[roles/users] create failed", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const authorization = await requireWorkspaceAdmin();
  if (!authorization.ok) return authorization.response;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const agentId = String(body?.agentId ?? "").trim();
  if (!agentId) {
    return NextResponse.json({ ok: false, error: "User ID is required." }, { status: 400 });
  }
  const payload = body ?? {};

  if (payload.password) {
    const newPassword = String(payload.password).trim();
    const res = await resetSalesAgentPasswordFromAdmin({ agentId, password: newPassword });
    if (!res.ok) {
      return NextResponse.json(res, { status: 400 });
    }
  }

  if (payload.role || payload.status || Object.prototype.hasOwnProperty.call(payload, "managerAgentId")) {
    const snapshot = await getSalesSnapshotForRole(authorization.session);
    const existing = (snapshot.agents?.length ? snapshot.agents : snapshot.visibleAgents).find((a) => a.id === agentId);
    if (!existing) {
      return NextResponse.json({ ok: false, error: "Workspace user was not found." }, { status: 404 });
    }
    const nextRoleInput = payload.role ? String(payload.role).toUpperCase() : resolveAgentRole(existing?.permissions ?? null);
    const nextRole: WorkspaceUserRole =
      nextRoleInput === "UNASSIGNED" || nextRoleInput === "ADMIN" || nextRoleInput === "MANAGER" || nextRoleInput === "SALES_AGENT"
        ? (nextRoleInput as WorkspaceUserRole)
        : "SALES_AGENT";
    const hasRoleChange = Boolean(payload.role);
    const requestedStatus = payload.status ? (String(payload.status).toUpperCase() as SalesAgentStatus) : undefined;
    const nextStatus: SalesAgentStatus = requestedStatus ?? (hasRoleChange ? (nextRole === "UNASSIGNED" ? "PENDING" : "ACTIVE") : existing.status);
    const hasManagerChange = Object.prototype.hasOwnProperty.call(payload, "managerAgentId");
    const requestedManagerId = String(payload.managerAgentId ?? "").trim();
    let nextManagerId = hasManagerChange ? requestedManagerId || null : existing.parentAgentId;
    let nextGroupId = existing.groupId;

    if (nextRole === "UNASSIGNED") {
      nextManagerId = null;
    } else if (nextRole !== "SALES_AGENT") {
      nextManagerId = null;
    } else if (hasManagerChange && nextManagerId) {
      const manager = snapshot.agents.find((agent) => agent.id === nextManagerId);
      if (!manager || manager.status !== "ACTIVE" || resolveAgentRole(manager.permissions) !== "MANAGER") {
        return NextResponse.json({ ok: false, error: "Choose an active manager from this workspace." }, { status: 400 });
      }
      nextGroupId = manager.groupId;
    }

    if (nextRole === "UNASSIGNED" && requestedStatus === "ACTIVE") {
      return NextResponse.json({ ok: false, error: "Assign a role before unlocking this user." }, { status: 400 });
    }

    await updateSalesAgentProfile({
      agentId,
      status: nextStatus,
      groupId: nextGroupId,
      parentAgentId: nextManagerId,
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
