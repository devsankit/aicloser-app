import { NextResponse } from "next/server";

import { requireSessionRole } from "@/lib/api/require-session-role";
import { createSalesAgentAccount, getSalesSnapshotForRole } from "@/lib/gigxomi/sales-store";

export async function GET() {
  const authorization = await requireSessionRole(["SUPER_ADMIN", "SALES_AGENT"]);
  if (!authorization.ok) return authorization.response;

  const snapshot = await getSalesSnapshotForRole(authorization.session);
  return NextResponse.json({ ok: true, agents: snapshot.visibleAgents, groups: snapshot.groups, leaderboard: snapshot.reports.leaderboard });
}

export async function POST(request: Request) {
  const authorization = await requireSessionRole(["SALES_AGENT", "ADMIN"]);
  if (!authorization.ok) return authorization.response;

  const snapshot = await getSalesSnapshotForRole(authorization.session);
  const currentAgent = snapshot.currentAgent;
  const isWorkspaceAdmin =
    authorization.session.role === "ADMIN" ||
    (currentAgent?.permissions && typeof currentAgent.permissions === "object" && Boolean((currentAgent.permissions as Record<string, unknown>).workspaceAdmin));

  if (!currentAgent?.canCreateSubAgents && !isWorkspaceAdmin) {
    return NextResponse.json({ ok: false, error: "Subagent creation is not enabled for your sales account yet." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ ok: false, error: "Send valid subagent details." }, { status: 400 });

  const created = await createSalesAgentAccount({
    displayName: String(body.displayName ?? ""),
    email: String(body.email ?? ""),
    phone: String(body.phone ?? ""),
    password: String(body.password ?? ""),
    createdByUserId: authorization.session.userId ?? undefined,
    tenantId: authorization.session.tenantId,
    status: isWorkspaceAdmin ? "ACTIVE" : "PENDING",
    groupId: currentAgent?.groupId || (snapshot.groups[0]?.id ?? "sales-group-main"),
    parentAgentId: currentAgent?.id ?? null,
    canClaimLeads: true,
    maxActiveLeads: 10,
  });

  if (!created.ok) {
    return NextResponse.json(created, { status: 400 });
  }

  return NextResponse.json({ ok: true, agent: created.agent });
}
