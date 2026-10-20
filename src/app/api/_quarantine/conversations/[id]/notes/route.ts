import { NextResponse } from "next/server";

import { requireSessionRole } from "@/lib/api/require-session-role";
import { persistRealtimeEvent } from "@/lib/realtime/event-outbox";
import { prisma } from "@/lib/prisma";
import { mapCentralConversation } from "@/lib/central-chat-mapper";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const authorization = await requireSessionRole(["SUPER_ADMIN", "ADMIN", "MANAGER", "SALES_AGENT"]);
  if (!authorization.ok) {
    return authorization.response;
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const tenantId = authorization.session.role === "SUPER_ADMIN" ? undefined : authorization.session.tenantId?.trim() || undefined;

  // 1. Fetch live conversation with tenant isolation
  const dbConversation = await prisma.appConversation.findFirst({
    where: {
      id,
      ...(tenantId ? { tenantId } : {}),
    },
  });

  if (!dbConversation) {
    return NextResponse.json({ ok: false, error: "Conversation not found" }, { status: 404 });
  }

  const notes = typeof body.notes === "string" ? body.notes.trim() : typeof body.body === "string" ? body.body.trim() : "";
  const nextFollowUpAt = body.nextFollowUpAt !== undefined ? (body.nextFollowUpAt ? String(body.nextFollowUpAt) : null) : undefined;

  // 2. Persist updated internal notes & follow-up into PostgreSQL payload
  const currentPayload =
    dbConversation.payload && typeof dbConversation.payload === "object" && !Array.isArray(dbConversation.payload)
      ? (dbConversation.payload as Record<string, unknown>)
      : {};

  const updatedPayload = {
    ...currentPayload,
    internalNotes: notes,
    ...(nextFollowUpAt !== undefined ? { nextFollowUpAt } : {}),
    updatedAt: new Date().toISOString(),
  };

  await prisma.appConversation.update({
    where: { id },
    data: {
      payload: updatedPayload as any,
      updatedAt: new Date(),
    },
  });

  // 3. Two-way synchronization with linked SalesLeadAssignment
  const phoneDigits = String(dbConversation.customerPhone ?? "").replace(/\D/g, "");
  const leads = await prisma.salesLeadAssignment.findMany({
    where: {
      ...(tenantId ? { tenantId } : {}),
      OR: [
        { conversationId: id },
        ...(phoneDigits.length >= 10 ? [{ customerPhone: { endsWith: phoneDigits.slice(-10) } }] : []),
      ],
    },
    select: { id: true, notes: true, tenantId: true, stage: true },
  });

  if (leads.length) {
    const followUpDate = nextFollowUpAt === undefined ? undefined : nextFollowUpAt ? new Date(nextFollowUpAt) : null;
    await prisma.salesLeadAssignment.updateMany({
      where: { id: { in: leads.map((lead) => lead.id) } },
      data: {
        notes,
        ...(nextFollowUpAt !== undefined ? { followUpAt: followUpDate } : {}),
        conversationId: id,
        updatedAt: new Date(),
      },
    });

    if (notes) {
      await prisma.salesLeadTimelineEntry.createMany({
        data: leads.map((lead) => ({
          tenantId: lead.tenantId ?? dbConversation.tenantId,
          leadId: lead.id,
          userId: authorization.session.userId,
          type: "NOTE",
          body: notes,
          metadata: { conversationId: id, source: "CHAT_WORKSPACE" },
        })),
      });
    }
  }

  // 4. Dispatch live realtime events to workspace subscribers
  const effectiveTenantId = dbConversation.tenantId;
  await persistRealtimeEvent({
    topic: `tenant:${effectiveTenantId}`,
    tenantId: effectiveTenantId,
    actorUserId: authorization.session.userId,
    audienceRoles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "SALES_AGENT"],
    eventType: "lead.updated",
    payload: { conversationId: id, nextFollowUpAt: nextFollowUpAt ?? null, notes },
  }).catch(() => undefined);

  await persistRealtimeEvent({
    topic: `tenant:${effectiveTenantId}`,
    tenantId: effectiveTenantId,
    actorUserId: authorization.session.userId,
    audienceRoles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "SALES_AGENT"],
    eventType: "lead.note_updated",
    payload: {
      conversationId: id,
      leadId: leads[0]?.id || id,
      customerName: dbConversation.customerName,
      leadName: dbConversation.customerName,
      nextFollowUpAt: nextFollowUpAt ?? null,
      followUpAt: nextFollowUpAt ?? null,
      notes,
      note: notes,
    },
  }).catch(() => undefined);

  // 5. Construct canonical conversation projection directly from DB
  const rawMessages = Array.isArray(currentPayload.messages) ? (currentPayload.messages as never[]) : [];
  const conversationView = mapCentralConversation(
    {
      id: dbConversation.id,
      customerName: dbConversation.customerName,
      customerPhone: dbConversation.customerPhone,
      status: dbConversation.status,
      stage: leads[0]?.stage || dbConversation.leadStatusId,
      leadStage: leads[0]?.stage,
      leadId: leads[0]?.id,
      updatedAt: new Date().toISOString(),
    },
    rawMessages
  );

  return NextResponse.json({
    ok: true,
    persisted: true,
    notes,
    conversation: {
      ...conversationView,
      internalNotes: notes,
      ...(nextFollowUpAt !== undefined ? { nextFollowUpAt } : {}),
    },
  });
}
