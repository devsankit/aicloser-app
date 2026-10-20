import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

import { requireSessionRole } from "@/lib/api/require-session-role";
import { prisma } from "@/lib/prisma";
import { mapCentralConversation } from "@/lib/central-chat-adapter";

export async function POST(request: Request) {
  const authorization = await requireSessionRole(["SUPER_ADMIN", "ADMIN", "MANAGER", "SALES_AGENT"]);
  if (!authorization.ok) {
    return authorization.response;
  }

  const body = await request.json().catch(() => ({}));
  const customerName = String(body.customerName ?? "New Lead").trim();
  const customerPhone = String(body.customerPhone ?? "").trim();
  const tenantId = authorization.session.role === "SUPER_ADMIN" ? (body.tenantId || "tenant-gigxomi") : authorization.session.tenantId?.trim() || "tenant-gigxomi";

  if (!customerPhone) {
    return NextResponse.json({ ok: false, error: "Customer phone is required." }, { status: 400 });
  }

  const conversationId = `conv-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const initialMessage = body.initialMessage ? String(body.initialMessage).trim() : null;
  const initialMessages = initialMessage
    ? [
        {
          id: `msg-${Date.now()}-${randomUUID().slice(0, 6)}`,
          body: initialMessage,
          lane: "customer",
          senderRole: "sales",
          senderUserId: authorization.session.userId,
          senderLabel: authorization.session.displayName || "Sales closer",
          senderType: "HUMAN",
          status: "sent",
          createdAt: new Date().toISOString(),
        },
      ]
    : [];

  const dbConversation = await prisma.appConversation.create({
    data: {
      id: conversationId,
      tenantId,
      customerName,
      customerPhone,
      status: "Active",
      leadStatusId: "new",
      serviceId: "svc-whatsapp-intake",
      serviceSlug: "whatsapp",
      payload: {
        messages: initialMessages,
        lastMessage: initialMessages[0] ?? null,
        channel: "WHATSAPP",
        createdAt: new Date().toISOString(),
      } as any,
    },
  });

  // Create linked SalesLeadAssignment in CRM
  let lead = null;
  try {
    const agentProfile = await prisma.salesAgentProfile.findFirst({
      where: { userId: authorization.session.userId },
    });

    if (agentProfile) {
      lead = await prisma.salesLeadAssignment.create({
        data: {
          tenantId,
          assignedAgentId: agentProfile.id,
          customerName,
          customerPhone,
          stage: "NEW",
          conversationId,
          source: "manual",
        },
      });
    }
  } catch (err) {
    console.warn("[api/conversations/new] Failed to create linked lead assignment:", err);
  }

  const conversationView = mapCentralConversation(
    {
      id: dbConversation.id,
      customerName: dbConversation.customerName,
      customerPhone: dbConversation.customerPhone,
      status: dbConversation.status,
      stage: lead?.stage || "NEW",
      leadStage: lead?.stage,
      leadId: lead?.id,
      updatedAt: dbConversation.updatedAt.toISOString(),
    },
    initialMessages as never[]
  );

  return NextResponse.json({
    ok: true,
    conversation: conversationView,
  });
}
