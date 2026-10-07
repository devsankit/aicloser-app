import { NextResponse } from "next/server";

import { getConversationViewForSession } from "@/lib/api/conversation-view-response";
import { requireSessionRole } from "@/lib/api/require-session-role";
import { getGxCustomer360ForConversation } from "@/lib/gxclosers/customer-360";
import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const authorization = await requireSessionRole(["SUPER_ADMIN", "ADMIN", "MANAGER", "SALES_AGENT"]);
  if (!authorization.ok) {
    return authorization.response;
  }

  const { id } = await context.params;
  const conversation = await getConversationViewForSession(authorization.session, id);
  if (!conversation) {
    return NextResponse.json({ ok: false, error: "Conversation not found" }, { status: 404 });
  }

  let customerPhone: string | null = null;
  if (!customerPhone && process.env.DATABASE_URL?.trim()) {
    try {
      const dbConv = await prisma.appConversation.findUnique({
        where: { id },
        select: { customerPhone: true },
      });
      if (dbConv?.customerPhone) {
        customerPhone = dbConv.customerPhone;
      }
    } catch {}
  }

  const customer360 = await getGxCustomer360ForConversation(id, customerPhone);
  const normalizedCustomer360 = customer360
    ? {
        ...customer360,
        // Keep the API shape consumed by the chat drawer while the 360
        // service exposes its richer combined timeline as `timeline`.
        salesTimeline: "timeline" in customer360 && Array.isArray(customer360.timeline)
          ? customer360.timeline.map((entry) => ({
              id: entry.id,
              type: entry.type,
              body: entry.detail || entry.title || "",
              createdAt: entry.at,
            }))
          : [],
      }
    : null;

  return NextResponse.json({
    ok: true,
    customer360: normalizedCustomer360 ?? {
      app: null,
      identity: { appUserId: null, method: null, status: "UNRESOLVED", verifiedAt: null },
      journey: { snapshots: [] },
      lead: null,
      calls: [],
      deals: [],
      salesTimeline: [],
      tasks: [],
      webinars: [],
      journeyEvents: [],
      identityStatus: "UNRESOLVED",
      notifications: [],
      learning: [],
      notificationSummary: { sent: 0, unread: 0 },
      subscriptions: [],
      sourceContext: { imported: null, stageHistory: [] },
      onboarding: null,
    },
    conversation: {
      id: conversation.id,
      customerName: conversation.customerDisplayName ?? null,
      customerPhone,
      leadStatusId: conversation.leadStatusId ?? null,
      internalNotes: conversation.internalNotes ?? "",
      nextFollowUpAt: conversation.nextFollowUpAt ?? null,
      aiAutoReplyDisabled: conversation.aiAutoReplyDisabled ?? false,
    },
  });
}

