import { NextResponse } from "next/server";

import { requireSalesMobileSession } from "@/lib/api/require-sales-mobile-session";
import { prisma } from "@/lib/prisma";

function getLatestMessagePreview(payload: unknown) {
  const messages = payload && typeof payload === "object" && Array.isArray((payload as { messages?: unknown[] }).messages)
    ? (payload as { messages: Array<{ body?: unknown; createdAt?: unknown }> }).messages
    : [];
  const latest = [...messages].sort((left, right) => new Date(String(right.createdAt ?? "")).getTime() - new Date(String(left.createdAt ?? "")).getTime())[0];
  return latest
    ? { body: typeof latest.body === "string" ? latest.body : "", createdAt: typeof latest.createdAt === "string" ? latest.createdAt : null }
    : null;
}

export async function GET(request: Request) {
  const authorization = await requireSalesMobileSession();
  if (!authorization.ok) return authorization.response;
  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor")?.trim() || "";
  const profile = await prisma.salesAgentProfile.findUnique({
    where: { userId: authorization.session.userId },
    select: { id: true, tenantId: true },
  });
  if (!profile) return NextResponse.json({ ok: false, error: "Sales profile was not found." }, { status: 403 });
  // Mobile bootstrap performs the idempotent legacy-link reconciliation once.
  // Inbox reads stay fast and query only the agent-scoped projection.
  const leads = await prisma.salesLeadAssignment.findMany({
    where: {
      ...(authorization.actor.role === "SALES_AGENT" ? { assignedAgentId: profile.id } : { tenantId: profile.tenantId }),
      conversationId: { not: null },
      ...(cursor ? { id: { gt: cursor } } : {}),
    },
    orderBy: { id: "asc" },
    take: 31,
  });
  const page = leads.slice(0, 30);
  const conversations = await prisma.appConversation.findMany({ where: { id: { in: page.map((lead) => lead.conversationId).filter((value): value is string => Boolean(value)) } } });
  const byId = new Map(conversations.map((item) => [item.id, item]));
  return NextResponse.json({
    ok: true,
    conversations: page.map((lead) => ({
      lead: {
        id: lead.id,
        customerName: lead.customerName,
        customerPhone: lead.customerPhone,
        customerEmail: lead.customerEmail,
        stage: lead.stage,
        priority: lead.priority,
        serviceInterest: lead.serviceInterest,
        updatedAt: lead.updatedAt,
      },
      conversation: lead.conversationId
        ? (() => {
            const conversation = byId.get(lead.conversationId);
            return conversation
              ? {
                  id: conversation.id,
                  latestMessage: getLatestMessagePreview(conversation.payload),
                  status: conversation.status,
                  updatedAt: conversation.updatedAt,
                }
              : null;
          })()
        : null,
    })),
    nextCursor: leads.length > 30 ? page[page.length - 1]?.id ?? null : null,
  });
}
