import { NextResponse } from "next/server";

import { getConversationViewForSession } from "@/lib/api/conversation-view-response";
import { requireSessionRole } from "@/lib/api/require-session-role";
import { updateConversationInternalNotesFromFile } from "@/lib/gigxomi/dummy-platform-file-store";
import { persistRealtimeEvent } from "@/lib/realtime/event-outbox";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const authorization = await requireSessionRole(["SUPER_ADMIN", "ADMIN", "MANAGER", "SALES_AGENT", "FREELANCER"]);
  if (!authorization.ok) {
    return authorization.response;
  }

  const { id } = await context.params;
  const body = await request.json();
  if (!(await getConversationViewForSession(authorization.session, id))) {
    return NextResponse.json({ ok: false, error: "Conversation not found" }, { status: 404 });
  }

  const nextFollowUpAt = body.nextFollowUpAt !== undefined ? (body.nextFollowUpAt ? String(body.nextFollowUpAt) : null) : undefined;
  const notes = typeof body.notes === "string" ? body.notes.trim() : "";
  let persistedNotes = notes;

  // 1. Keep the in-memory platform snapshot and disk file store updated synchronously
  // so that all concurrent/subsequent inbox listings and view queries immediately see the new notes.
  await updateConversationInternalNotesFromFile(id, notes, nextFollowUpAt).catch(() => null);

  // 2. Persist to PostgreSQL database when DATABASE_URL is configured
  if (process.env.DATABASE_URL?.trim()) {
    const dbConversation = await prisma.appConversation.findUnique({
      where: { id },
      select: { customerPhone: true, payload: true },
    });
    if (dbConversation) {
      const currentPayload =
        dbConversation.payload && typeof dbConversation.payload === "object" && !Array.isArray(dbConversation.payload)
          ? (dbConversation.payload as Record<string, unknown>)
          : {};
      const payload = {
        ...currentPayload,
        internalNotes: notes,
        ...(nextFollowUpAt !== undefined ? { nextFollowUpAt } : {}),
        updatedAt: new Date().toISOString(),
      };
      await prisma.appConversation.update({
        where: { id },
        data: { payload, updatedAt: new Date() },
      });

      const phoneDigits = String(dbConversation.customerPhone ?? "").replace(/\D/g, "");
      const leads = await prisma.salesLeadAssignment.findMany({
        where: {
          OR: [
            { conversationId: id },
            ...(phoneDigits.length >= 10 ? [{ customerPhone: { endsWith: phoneDigits.slice(-10) } }] : []),
          ],
        },
        select: { id: true, notes: true, tenantId: true },
      });
      if (leads.length) {
        const followUpAt = nextFollowUpAt === undefined ? undefined : nextFollowUpAt ? new Date(nextFollowUpAt) : null;
        await prisma.salesLeadAssignment.updateMany({
          where: { id: { in: leads.map((lead) => lead.id) } },
          data: { notes, ...(nextFollowUpAt !== undefined ? { followUpAt } : {}), conversationId: id, updatedAt: new Date() },
        });
        if (notes) {
          await prisma.salesLeadTimelineEntry.createMany({
            data: leads.map((lead) => ({
              tenantId: lead.tenantId ?? authorization.session.tenantId ?? "tenant-gigxomi",
              leadId: lead.id,
              userId: authorization.session.userId,
              type: "NOTE",
              body: notes,
              metadata: { conversationId: id },
            })),
          });
        }
      }
    } else {
      return NextResponse.json({ ok: false, error: "Conversation not found" }, { status: 404 });
    }
  }

  const conversationView = await getConversationViewForSession(authorization.session, id);
  const guaranteedView = conversationView
    ? {
        ...conversationView,
        internalNotes: persistedNotes,
        ...(nextFollowUpAt !== undefined ? { nextFollowUpAt } : {}),
      }
    : null;

  const leadName = conversationView?.customerName || "Lead";
  await persistRealtimeEvent({
    topic: `tenant:${authorization.session.tenantId ?? "tenant-gigxomi"}`,
    tenantId: authorization.session.tenantId,
    actorUserId: authorization.session.userId,
    audienceRoles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "SALES_AGENT"],
    eventType: "lead.note_updated",
    payload: {
      conversationId: id,
      leadId: id,
      customerName: leadName,
      leadName,
      nextFollowUpAt: nextFollowUpAt ?? null,
      followUpAt: nextFollowUpAt ?? null,
      notes,
      note: notes,
    },
  }).catch(() => undefined);

  return NextResponse.json({
    ok: true,
    persisted: true,
    notes: persistedNotes,
    conversation: guaranteedView,
  });
}
