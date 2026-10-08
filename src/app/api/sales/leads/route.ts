import { NextResponse } from "next/server";

import { requireSessionRole } from "@/lib/api/require-session-role";
import { claimSalesLeadPoolItem, createSalesLead, createSalesLeadPoolItem, getSalesSnapshotForRole, reassignSalesLead, updateSalesLead, updateSalesLeadStage, type SalesLeadStage } from "@/lib/gigxomi/sales-store";
import { readRoundRobinSettings } from "@/lib/gigxomi/round-robin-service";
import { resolveSessionTenantId } from "@/lib/api/resolve-session-tenant";

const salesLeadStages = new Set<SalesLeadStage>([
  "NEW", "ASSIGNED", "CONTACTED", "INTERESTED", "WEBINAR_INVITED", "WEBINAR_ATTENDED", "FOLLOW_UP", "NEGOTIATION", "CLOSED_WON", "CLOSED_LOST", "NOT_REACHABLE", "RECYCLED", "QUALIFIED", "QUOTE_SENT", "PAYMENT_PENDING", "PAID", "HANDOFF", "CONVERTED_FREE", "CLOSED", "LOST",
]);

export async function GET() {
  const authorization = await requireSessionRole(["SUPER_ADMIN", "ADMIN", "MANAGER", "SALES_AGENT"]);
  if (!authorization.ok) return authorization.response;

  const snapshot = await getSalesSnapshotForRole(authorization.session);
  return NextResponse.json({ ok: true, leadPool: snapshot.visibleLeadPool, leads: snapshot.visibleLeads, agents: snapshot.visibleAgents });
}

export async function POST(request: Request) {
  const authorization = await requireSessionRole(["SUPER_ADMIN", "ADMIN", "MANAGER", "SALES_AGENT"]);
  if (!authorization.ok) return authorization.response;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ ok: false, error: "Send valid lead details." }, { status: 400 });
  const snapshot = await getSalesSnapshotForRole(authorization.session);

  const canModifyLeadData =
    authorization.session.role === "ADMIN" ||
    authorization.session.role === "SUPER_ADMIN" ||
    (await readRoundRobinSettings(resolveSessionTenantId(authorization.session))).allowNonAdminModifyLeads;

  if (body.action === "stage") {
    if (!canModifyLeadData) {
      return NextResponse.json({ ok: false, error: "Lead updates are disabled for your role. Ask a workspace administrator to enable them." }, { status: 403 });
    }
    const leadId = String(body.leadId ?? "");
    if (!snapshot.visibleLeads.some((lead) => lead.id === leadId)) {
      return NextResponse.json({ ok: false, error: "You do not have access to this lead." }, { status: 403 });
    }
    const stage = String(body.stage ?? "NEW") as SalesLeadStage;
    if (!salesLeadStages.has(stage)) return NextResponse.json({ ok: false, error: "Choose a valid lead stage." }, { status: 400 });
    const note = typeof body.note === "string" ? body.note.trim() : "";
    const followUpAt = typeof body.followUpAt === "string" ? body.followUpAt.trim() : "";
    if (followUpAt && Number.isNaN(new Date(followUpAt).getTime())) {
      return NextResponse.json({ ok: false, error: "Choose a valid follow-up date." }, { status: 422 });
    }
    const requiresReason = new Set<SalesLeadStage>(["CLOSED_LOST", "LOST", "NOT_REACHABLE", "RECYCLED"]);
    if (requiresReason.has(stage) && note.length < 3) {
      return NextResponse.json({ ok: false, error: "Add the reason before closing or recycling this lead." }, { status: 422 });
    }
    if (stage === "PAID") {
      const confirmedDeal = snapshot.visibleDeals.find((deal) => deal.assignmentId === leadId && ["PAID", "HANDOFF", "CLOSED"].includes(deal.status) && deal.paidAmount > 0);
      if (!confirmedDeal) return NextResponse.json({ ok: false, error: "Paid stage requires a confirmed successful payment or closed deal." }, { status: 422 });
    }
    const lead = await updateSalesLeadStage({
      leadId,
      stage,
      note: note || undefined,
      followUpAt: followUpAt || undefined,
      actorUserId: authorization.session.userId,
    });
    return lead ? NextResponse.json({ ok: true, lead, meta: lead.metaSync ?? null }) : NextResponse.json({ ok: false, error: "Lead not found." }, { status: 404 });
  }

  if (body.action === "claim") {
    const requestedAgentId = String(body.agentId ?? "").trim();
    const currentAgentId = snapshot.currentAgent?.id ?? "";
    if (authorization.session.role === "SALES_AGENT" && requestedAgentId && requestedAgentId !== currentAgentId) {
      return NextResponse.json({ ok: false, error: "You can only claim leads for your own sales profile." }, { status: 403 });
    }
    const agentId = authorization.session.role === "SALES_AGENT"
      ? currentAgentId
      : requestedAgentId || currentAgentId;
    if (!agentId) return NextResponse.json({ ok: false, error: "Sales agent profile not found." }, { status: 400 });
    try {
      const result = await claimSalesLeadPoolItem({
        poolItemId: String(body.poolItemId ?? ""),
        agentId,
        actorUserId: authorization.session.userId,
      });
      return NextResponse.json({ ok: true, ...result });
    } catch (error) {
      return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unable to claim lead." }, { status: 400 });
    }
  }

  if (body.action === "assign") {
    if (!["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(authorization.session.role)) {
      return NextResponse.json({ ok: false, error: "Only workspace admins and managers can reassign leads." }, { status: 403 });
    }
    const leadId = String(body.leadId ?? "");
    const assignedAgentId = String(body.assignedAgentId ?? "");
    const visibleAgents = snapshot.visibleAgents;
    const targetAgent = visibleAgents.find((agent) => agent.id === assignedAgentId && agent.status === "ACTIVE");
    if (!snapshot.visibleLeads.some((lead) => lead.id === leadId)) {
      return NextResponse.json({ ok: false, error: "You do not have access to this lead." }, { status: 403 });
    }
    if (!targetAgent) {
      return NextResponse.json({ ok: false, error: "Choose an active sales agent from this workspace." }, { status: 400 });
    }
    const lead = await reassignSalesLead({ leadId, assignedAgentId, actorUserId: authorization.session.userId });
    return lead
      ? NextResponse.json({ ok: true, lead })
      : NextResponse.json({ ok: false, error: "Lead not found." }, { status: 404 });
  }

  if (body.action === "queue") {
    const isWorkspaceAdmin =
      authorization.session.role === "SUPER_ADMIN" ||
      authorization.session.role === "ADMIN" ||
      Boolean(snapshot.currentAgent?.canCreateSubAgents);
    if (!isWorkspaceAdmin) {
      return NextResponse.json({ ok: false, error: "Only workspace admins can add round-robin queue leads." }, { status: 403 });
    }
    const requestedAgentId = typeof body.assignedAgentId === "string" ? body.assignedAgentId.trim() : null;
    const assignedAgentId = requestedAgentId && snapshot.visibleAgents.some((a) => a.id === requestedAgentId)
      ? requestedAgentId
      : (["ADMIN", "SUPER_ADMIN", "MANAGER"].includes(authorization.session.role)
        ? null
        : (snapshot.currentAgent?.id || null));

    const lead = await createSalesLeadPoolItem({
      tenantId: resolveSessionTenantId(authorization.session),
      assignedAgentId,
      customerName: String(body.customerName ?? ""),
      customerPhone: String(body.customerPhone ?? ""),
      customerEmail: String(body.customerEmail ?? ""),
      source: String(body.source ?? "round_robin"),
      serviceInterest: String(body.serviceInterest ?? "Editor deal"),
      segment: String(body.segment ?? ""),
      priority: String(body.priority ?? "normal"),
      budgetAmount: Number(body.budgetAmount ?? 0),
      notes: String(body.notes ?? ""),
    });
    return NextResponse.json({ ok: true, lead });
  }

  if (body.action === "update") {
    if (!canModifyLeadData) {
      return NextResponse.json({ ok: false, error: "Lead updates are disabled for your role. Ask a workspace administrator to enable them." }, { status: 403 });
    }
    const leadId = String(body.leadId ?? "");
    if (!snapshot.visibleLeads.some((lead) => lead.id === leadId)) {
      return NextResponse.json({ ok: false, error: "You do not have access to this lead." }, { status: 403 });
    }
    const lead = await updateSalesLead({
      leadId,
      customerName: typeof body.customerName === "string" ? body.customerName : undefined,
      customerPhone: typeof body.customerPhone === "string" ? body.customerPhone : undefined,
      customerEmail: typeof body.customerEmail === "string" ? body.customerEmail : undefined,
      serviceInterest: typeof body.serviceInterest === "string" ? body.serviceInterest : undefined,
      segment: typeof body.segment === "string" ? body.segment : undefined,
      priority: typeof body.priority === "string" ? body.priority : undefined,
      tags: Array.isArray(body.tags) ? body.tags.map(String) : typeof body.tags === "string" ? body.tags.split(",").map((item) => item.trim()).filter(Boolean) : undefined,
      budgetAmount: Number.isFinite(Number(body.budgetAmount)) ? Number(body.budgetAmount) : undefined,
      followUpAt: typeof body.followUpAt === "string" ? body.followUpAt : undefined,
      lastContactedAt: typeof body.lastContactedAt === "string" ? body.lastContactedAt : undefined,
      notes: typeof body.notes === "string" ? body.notes : undefined,
      conversationId: typeof body.conversationId === "string" ? body.conversationId : undefined,
      actorUserId: authorization.session.userId,
    });
    return NextResponse.json({ ok: true, lead });
  }

  const assignedAgentId = String(body.assignedAgentId ?? snapshot.currentAgent?.id ?? "");
  if (!assignedAgentId) return NextResponse.json({ ok: false, error: "Choose a sales agent for this lead." }, { status: 400 });

  if (authorization.session.role !== "SUPER_ADMIN" && !snapshot.visibleAgents.some((a) => a.id === assignedAgentId)) {
    return NextResponse.json({ ok: false, error: "The selected agent does not belong to your workspace." }, { status: 403 });
  }

  const lead = await createSalesLead({
    assignedAgentId,
    customerName: String(body.customerName ?? ""),
    customerPhone: String(body.customerPhone ?? ""),
    customerEmail: String(body.customerEmail ?? ""),
    source: String(body.source ?? "manual"),
    serviceInterest: String(body.serviceInterest ?? "Editor deal"),
    segment: String(body.segment ?? ""),
    priority: String(body.priority ?? "normal"),
    tags: typeof body.tags === "string" ? body.tags.split(",").map((item) => item.trim()).filter(Boolean) : [],
    budgetAmount: Number(body.budgetAmount ?? 0),
    notes: String(body.notes ?? ""),
    actorUserId: authorization.session.userId,
  });

  return NextResponse.json({ ok: true, lead });
}
