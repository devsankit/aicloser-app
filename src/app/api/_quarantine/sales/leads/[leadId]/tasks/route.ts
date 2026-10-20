import { NextResponse } from "next/server";

import { requireSessionRole } from "@/lib/api/require-session-role";
import { getSalesSnapshotForRole } from "@/lib/gigxomi/sales-store";
import { createGxLeadTask, getGxCustomer360, updateGxLeadTask } from "@/lib/gxclosers/customer-360";
import { centralApiRequest } from "@/lib/central-api-server";

async function authorizeLead(leadId: string) {
  const authorization = await requireSessionRole(["SUPER_ADMIN", "ADMIN", "MANAGER", "SALES_AGENT"]);
  if (!authorization.ok) return authorization;
  const snapshot = await getSalesSnapshotForRole(authorization.session);
  return snapshot.visibleLeads.some((lead) => lead.id === leadId)
    ? authorization
    : { ok: false as const, response: NextResponse.json({ ok: false, error: "Lead not found." }, { status: 404 }) };
}

export async function GET(_request: Request, context: { params: Promise<{ leadId: string }> }) {
  try {
    const { leadId } = await context.params;
    const payload = await centralApiRequest<{ data?: unknown[] }>(`/leads/${encodeURIComponent(leadId)}/tasks`);
    return NextResponse.json({ ok: true, tasks: payload.data ?? [] });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Central tasks API unavailable." }, { status: 502 });
  }

  const { leadId } = await context.params;
  const authorization = await authorizeLead(leadId);
  if (!authorization.ok) return authorization.response;
  const customer360 = await getGxCustomer360(leadId);
  return NextResponse.json({ ok: true, tasks: customer360?.tasks ?? [] });
}

export async function POST(request: Request, context: { params: Promise<{ leadId: string }> }) {
  try {
    const { leadId } = await context.params;
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ ok: false, error: "Task details are required." }, { status: 400 });
    if (body.action === "status") {
      const taskId = String(body.taskId ?? "").trim();
      const payload = await centralApiRequest(`/leads/${encodeURIComponent(leadId)}/tasks/${encodeURIComponent(taskId)}`, {
        method: "PATCH",
        body: JSON.stringify({ status: body.status }),
      });
      return NextResponse.json({ ok: true, task: (payload as { data?: unknown }).data ?? payload });
    }
    const payload = await centralApiRequest(`/leads/${encodeURIComponent(leadId)}/tasks`, {
      method: "POST",
      body: JSON.stringify({ title: body.title, description: body.description, dueAt: body.dueAt, priority: body.priority }),
    });
    return NextResponse.json({ ok: true, task: (payload as { data?: unknown }).data ?? payload });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Central tasks API unavailable." }, { status: 502 });
  }

  const { leadId } = await context.params;
  const authorization = await authorizeLead(leadId);
  if (!authorization.ok) return authorization.response;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ ok: false, error: "Task details are required." }, { status: 400 });

  if (body.action === "status") {
    const status = String(body.status ?? "").toUpperCase();
    if (!new Set(["OPEN", "DONE", "CANCELLED"]).has(status)) return NextResponse.json({ ok: false, error: "Choose a valid task status." }, { status: 400 });
    const updated = await updateGxLeadTask({ salesLeadId: leadId, status: status as "CANCELLED" | "DONE" | "OPEN", taskId: String(body.taskId ?? ""), userId: authorization.session.userId });
    return updated ? NextResponse.json({ ok: true, task: updated }) : NextResponse.json({ ok: false, error: "Task not found." }, { status: 404 });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const dueAt = typeof body.dueAt === "string" ? new Date(body.dueAt) : null;
  if (!title || !dueAt || Number.isNaN(dueAt.getTime())) return NextResponse.json({ ok: false, error: "A title and valid due date are required." }, { status: 400 });
  const priority = String(body.priority ?? "NORMAL").toUpperCase();
  if (!new Set(["LOW", "NORMAL", "HIGH", "URGENT"]).has(priority)) return NextResponse.json({ ok: false, error: "Choose a valid priority." }, { status: 400 });
  const task = await createGxLeadTask({ createdById: authorization.session.userId, description: typeof body.description === "string" ? body.description : undefined, dueAt, priority, salesLeadId: leadId, title });
  return NextResponse.json({ ok: true, task });
}
