import { NextResponse } from "next/server";
import type { SalesLeadStage } from "@prisma/client";

import { requireSessionRole } from "@/lib/api/require-session-role";
import { prisma } from "@/lib/prisma";
import { persistRealtimeEvent } from "@/lib/realtime/event-outbox";
import { mapCentralConversation } from "@/lib/central-chat-mapper";

const stageMap: Record<string, SalesLeadStage> = {
  "new": "NEW",
  "new-leads": "NEW",
  "new leads": "NEW",
  "contacted": "CONTACTED",
  "in_progress": "CONTACTED",
  "in-progress": "CONTACTED",
  "qualified": "INTERESTED",
  "interested": "INTERESTED",
  "interested / qualified": "INTERESTED",
  "training-booked": "WEBINAR_INVITED",
  "training booked": "WEBINAR_INVITED",
  "webinar-invited": "WEBINAR_INVITED",
  "demo": "WEBINAR_INVITED",
  "follow-up": "FOLLOW_UP",
  "follow_up": "FOLLOW_UP",
  "follow-up needed": "FOLLOW_UP",
  "negotiation": "FOLLOW_UP",
  "closed": "CLOSED_WON",
  "closed-won": "CLOSED_WON",
  "closed won": "CLOSED_WON",
  "won": "CLOSED_WON",
  "paid": "CLOSED_WON",
  "deal-closed": "CLOSED_WON",
  "lost": "CLOSED_LOST",
  "closed-lost": "CLOSED_LOST",
  "lost / recycled": "CLOSED_LOST",
  "recycled": "CLOSED_LOST",
  "not-interested": "CLOSED_LOST",
  "not-reachable": "NOT_REACHABLE",
};

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const authorization = await requireSessionRole(["SUPER_ADMIN", "ADMIN", "MANAGER", "SALES_AGENT"]);
  if (!authorization.ok) {
    return authorization.response;
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const tenantId = authorization.session.role === "SUPER_ADMIN" ? undefined : authorization.session.tenantId?.trim() || undefined;

  const leadStatusId = String(body.leadStatusId ?? body.stage ?? body.status ?? "").trim();
  if (!leadStatusId) {
    return NextResponse.json({ ok: false, error: "Choose a lead stage." }, { status: 400 });
  }

  // 1. Fetch live conversation with strict tenant isolation
  const existingDb = await prisma.appConversation.findFirst({
    where: {
      id,
      ...(tenantId ? { tenantId } : {}),
    },
  });

  if (!existingDb) {
    return NextResponse.json({ ok: false, error: "Conversation not found" }, { status: 404 });
  }

  // 2. Persist updated lead status directly into PostgreSQL
  const currentPayload =
    existingDb.payload && typeof existingDb.payload === "object" && !Array.isArray(existingDb.payload)
      ? (existingDb.payload as Record<string, unknown>)
      : {};

  await prisma.appConversation.update({
    where: { id },
    data: {
      leadStatusId,
      payload: {
        ...currentPayload,
        leadStatusId,
        updatedAt: new Date().toISOString(),
      } as any,
      updatedAt: new Date(),
    },
  });

  // 3. Two-way synchronization with Sales CRM Kanban pipeline
  const mappedStage = stageMap[leadStatusId.toLowerCase()];
  const phoneDigits = String(existingDb.customerPhone ?? "").replace(/\D/g, "");
  const matchingLeads = await prisma.salesLeadAssignment.findMany({
    where: {
      ...(tenantId ? { tenantId } : {}),
      OR: [
        { conversationId: id },
        ...(phoneDigits.length >= 10 ? [{ customerPhone: { endsWith: phoneDigits.slice(-10) } }] : []),
      ],
    },
    select: { id: true, stage: true, tenantId: true },
  });

  if (matchingLeads.length) {
    if (mappedStage) {
      await prisma.salesLeadAssignment.updateMany({
        where: { id: { in: matchingLeads.map((l) => l.id) } },
        data: {
          stage: mappedStage,
          conversationId: id,
          updatedAt: new Date(),
        },
      });
    }

    await prisma.salesLeadTimelineEntry.createMany({
      data: matchingLeads.map((l) => ({
        tenantId: l.tenantId ?? existingDb.tenantId,
        leadId: l.id,
        userId: authorization.session.userId,
        type: "STAGE_CHANGE",
        body: `Stage updated to ${mappedStage || leadStatusId}`,
        metadata: {
          conversationId: id,
          previousStage: l.stage,
          newStage: mappedStage || leadStatusId,
        },
      })),
    });
  }

  // 4. Dispatch live realtime event to workspace subscribers
  const effectiveTenantId = existingDb.tenantId;
  await persistRealtimeEvent({
    topic: `tenant:${effectiveTenantId}`,
    tenantId: effectiveTenantId,
    actorUserId: authorization.session.userId,
    audienceRoles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "SALES_AGENT"],
    eventType: "lead.updated",
    payload: { conversationId: id, leadStatusId, stage: mappedStage || leadStatusId },
  }).catch(() => undefined);

  // 5. Construct canonical conversation projection directly from DB
  const rawMessages = Array.isArray(currentPayload.messages) ? (currentPayload.messages as never[]) : [];
  const conversationView = mapCentralConversation(
    {
      id: existingDb.id,
      customerName: existingDb.customerName,
      customerPhone: existingDb.customerPhone,
      status: existingDb.status,
      stage: mappedStage || leadStatusId,
      leadStage: mappedStage,
      leadId: matchingLeads[0]?.id,
      updatedAt: new Date().toISOString(),
    },
    rawMessages
  );

  return NextResponse.json({
    ok: true,
    persisted: true,
    conversation: conversationView,
  });
}
