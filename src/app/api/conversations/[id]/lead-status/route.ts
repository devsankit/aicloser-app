import { NextResponse } from "next/server";
import type { SalesLeadStage } from "@prisma/client";

import { getConversationViewForSession } from "@/lib/api/conversation-view-response";
import { requireSessionRole } from "@/lib/api/require-session-role";
import { updateConversationLeadStatusFromFile } from "@/lib/gigxomi/dummy-platform-file-store";
import { syncLeadStatusToMetaAndOutbox } from "@/lib/gigxomi/lead-status-meta-sync";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const authorization = await requireSessionRole(["SUPER_ADMIN", "ADMIN", "MANAGER", "SALES_AGENT"]);
  if (!authorization.ok) {
    return authorization.response;
  }

  const { id } = await context.params;
  const body = await request.json();
  if (!(await getConversationViewForSession(authorization.session, id))) {
    return NextResponse.json({ ok: false, error: "Conversation not found" }, { status: 404 });
  }

  const leadStatusId = String(body.leadStatusId ?? "").trim();
  if (!leadStatusId) {
    return NextResponse.json({ ok: false, error: "Choose a lead stage." }, { status: 400 });
  }

  // The closer file snapshot can lag behind the canonical DB conversation.
  // Continue with the DB update when the file copy is missing.

  // Update DB if configured
  const databaseConfigured = Boolean(process.env.DATABASE_URL?.trim());
  let updatedInDatabase = false;
  if (databaseConfigured) {
    try {
      const existingDb = await prisma.appConversation.findUnique({ where: { id } });
      if (existingDb) {
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
            },
            updatedAt: new Date(),
          },
        });
        updatedInDatabase = true;

        // Two-way synchronization with Sales CRM Kanban pipeline
        const stageMap: Record<string, SalesLeadStage> = {
          "new": "NEW",
          "new-leads": "NEW",
          "new leads": "NEW",
          "contacted": "CONTACTED",
          "qualified": "INTERESTED",
          "interested": "INTERESTED",
          "interested / qualified": "INTERESTED",
          "training-booked": "WEBINAR_INVITED",
          "training booked": "WEBINAR_INVITED",
          "webinar-invited": "WEBINAR_INVITED",
          "follow-up": "FOLLOW_UP",
          "follow-up needed": "FOLLOW_UP",
          "closed": "CLOSED_WON",
          "closed-won": "CLOSED_WON",
          "closed won": "CLOSED_WON",
          "paid": "CLOSED_WON",
          "deal-closed": "CLOSED_WON",
          "lost": "CLOSED_LOST",
          "closed-lost": "CLOSED_LOST",
          "lost / recycled": "CLOSED_LOST",
          "recycled": "CLOSED_LOST",
          "not-interested": "CLOSED_LOST",
          "not-reachable": "NOT_REACHABLE",
        };
        const mappedStage = stageMap[leadStatusId.toLowerCase()];
        if (mappedStage) {
          // Find matching lead by conversationId or phone
          const matchingLeads = await prisma.salesLeadAssignment.findMany({
            where: {
              OR: [
                { conversationId: id },
                ...(existingDb.customerPhone ? [{ customerPhone: { endsWith: existingDb.customerPhone.replace(/\D/g, "").slice(-10) } }] : []),
              ],
            },
            select: { id: true },
          });
          if (matchingLeads.length) {
            await prisma.salesLeadAssignment.updateMany({
              where: { id: { in: matchingLeads.map((l) => l.id) } },
              data: {
                stage: mappedStage,
                conversationId: id,
                updatedAt: new Date(),
              },
            });
          }
        }
      }
    } catch (err) {
      console.error("[lead-status] DB update error:", err);
      return NextResponse.json({ ok: false, error: "Lead stage could not be saved." }, { status: 500 });
    }
  }

  // File snapshots are used for the demo/no-database mode. In DB mode the
  // canonical update above is immediate, so avoid blocking the request on a
  // full snapshot rewrite.
  if (!databaseConfigured && !updatedInDatabase) {
    const updatedConversation = await updateConversationLeadStatusFromFile(id, leadStatusId);
    if (!updatedConversation) {
      return NextResponse.json({ ok: false, error: "Lead stage could not be updated." }, { status: 404 });
    }
  }

  // Synchronize conversion to Meta CAPI & Realtime SSE
  const syncResult = await syncLeadStatusToMetaAndOutbox({
    conversationId: id,
    leadStatusId,
    notes: typeof body.notes === "string" ? body.notes : undefined,
    actorUserId: authorization.session.userId,
  });

  const conversationView = await getConversationViewForSession(authorization.session, id);

  return NextResponse.json({
    ok: true,
    persisted: true,
    conversation: conversationView,
    meta: syncResult.meta,
  });
}
