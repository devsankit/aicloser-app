import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

import { requireSessionRole } from "@/lib/api/require-session-role";
import { prisma } from "@/lib/prisma";
import { mapCentralConversation } from "@/lib/central-chat-adapter";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const authorization = await requireSessionRole(["SUPER_ADMIN", "ADMIN", "MANAGER", "SALES_AGENT"]);
  if (!authorization.ok) {
    return authorization.response;
  }

  const { id } = await context.params;
  const tenantId = authorization.session.role === "SUPER_ADMIN" ? undefined : authorization.session.tenantId?.trim() || undefined;

  const dbConversation = await prisma.appConversation.findFirst({
    where: {
      id,
      ...(tenantId ? { tenantId } : {}),
    },
  });

  if (!dbConversation) {
    return NextResponse.json({ ok: false, error: "Conversation not found." }, { status: 404 });
  }

  const currentPayload =
    dbConversation.payload && typeof dbConversation.payload === "object" && !Array.isArray(dbConversation.payload)
      ? (dbConversation.payload as Record<string, unknown>)
      : {};

  const existingMessages = Array.isArray(currentPayload.messages) ? (currentPayload.messages as Record<string, unknown>[]) : [];

  const reviewMessage: Record<string, unknown> = {
    id: `msg-${Date.now()}-${randomUUID().slice(0, 6)}`,
    body: "Please take a moment to review our interaction and rate your sales experience.",
    lane: "customer",
    senderRole: "system",
    senderLabel: "System",
    senderType: "SYSTEM",
    status: "sent",
    createdAt: new Date().toISOString(),
  };

  const updatedMessages = [...existingMessages, reviewMessage];

  await prisma.appConversation.update({
    where: { id },
    data: {
      payload: {
        ...currentPayload,
        messages: updatedMessages,
        lastMessage: reviewMessage,
        updatedAt: new Date().toISOString(),
      } as any,
      updatedAt: new Date(),
    },
  });

  const conversationView = mapCentralConversation(
    {
      id: dbConversation.id,
      customerName: dbConversation.customerName,
      customerPhone: dbConversation.customerPhone,
      status: dbConversation.status,
      stage: dbConversation.leadStatusId,
      updatedAt: new Date().toISOString(),
    },
    updatedMessages as never[]
  );

  return NextResponse.json({
    ok: true,
    conversation: conversationView,
  });
}
