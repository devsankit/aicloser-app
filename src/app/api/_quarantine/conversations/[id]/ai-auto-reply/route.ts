import { NextResponse } from "next/server";

import { requireSessionRole } from "@/lib/api/require-session-role";
import { centralApiRequest } from "@/lib/central-api-server";
import { prisma } from "@/lib/prisma";
import { mapCentralConversation } from "@/lib/central-chat-adapter";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const authorization = await requireSessionRole(["SUPER_ADMIN", "ADMIN", "MANAGER", "SALES_AGENT"]);
  if (!authorization.ok) {
    return authorization.response;
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const disabled = Boolean(body?.disabled);

  // 1. Central Dedicated API Engine
  try {
    const payload = await centralApiRequest(`/conversations/${encodeURIComponent(id)}/ai-auto-reply`, {
      method: "POST",
      body: JSON.stringify({ disabled, enabled: !disabled }),
    });
    return NextResponse.json({ ok: true, ...(payload as Record<string, unknown>) });
  } catch {
    // Proceed to Direct Live Database Fallback
  }

  // 2. Direct Live PostgreSQL Operations
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

  const currentAiSettings = (currentPayload.aiSettings as Record<string, unknown>) || {};
  const updatedAiSettings = {
    ...currentAiSettings,
    enabled: !disabled,
    mode: disabled ? "HUMAN_ONLY" : "AI_AUTO_REPLY",
    humanTakeover: disabled,
    updatedAt: new Date().toISOString(),
    updatedByUserId: authorization.session.userId,
  };

  await prisma.appConversation.update({
    where: { id },
    data: {
      payload: {
        ...currentPayload,
        aiSettings: updatedAiSettings,
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
    Array.isArray(currentPayload.messages) ? (currentPayload.messages as never[]) : []
  );

  return NextResponse.json({
    ok: true,
    conversation: {
      ...conversationView,
      aiAutoReplyDisabled: disabled,
    },
  });
}
