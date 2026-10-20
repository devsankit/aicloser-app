import { NextResponse } from "next/server";

import { requireSessionRole } from "@/lib/api/require-session-role";
import { sendMobileChatPushForConversation } from "@/lib/mobile-chat-push";
import { publishConversationRealtimeEvent } from "@/lib/gigxomi/conversation-realtime";
import { resolveWhatsAppSetupTenantId } from "@/lib/api/resolve-session-tenant";
import { sendLinkedWhatsAppText } from "@/lib/whatsapp/baileys-transport";
import { centralApiRequest } from "@/lib/central-api-server";
import { getCentralConversationMessages, mapCentralConversation } from "@/lib/central-chat-adapter";
import { persistRealtimeEvent } from "@/lib/realtime/event-outbox";
import { prisma } from "@/lib/prisma";

const MAX_CHAT_ATTACHMENT_BYTES = 20 * 1024 * 1024;

export interface MessageAttachmentInput {
  name: string;
  mimeType?: string;
  sizeBytes?: number;
  uploadTarget?: "youtube" | "local";
  durationSeconds?: number;
  note?: string;
  externalUrl?: string;
}

function normalizeAttachments(value: unknown): { attachments: MessageAttachmentInput[]; invalid: boolean } {
  if (!Array.isArray(value)) {
    return { attachments: [], invalid: false };
  }

  const attachments: MessageAttachmentInput[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") {
      return { attachments: [], invalid: true };
    }
    const candidate = item as Record<string, unknown>;
    const name = String(candidate.name ?? "").trim();
    if (!name) {
      return { attachments: [], invalid: true };
    }

    const rawSize = candidate.sizeBytes;
    const sizeBytes =
      typeof rawSize === "number" && Number.isFinite(rawSize) ? Math.max(0, Math.floor(rawSize)) : undefined;
    if (typeof sizeBytes === "number" && sizeBytes > MAX_CHAT_ATTACHMENT_BYTES) {
      return { attachments: [], invalid: true };
    }

    attachments.push({
      name,
      mimeType: typeof candidate.mimeType === "string" ? candidate.mimeType : undefined,
      sizeBytes,
      uploadTarget: candidate.uploadTarget === "youtube" ? "youtube" : "local",
      durationSeconds:
        typeof candidate.durationSeconds === "number" && Number.isFinite(candidate.durationSeconds)
          ? Math.max(0, Math.floor(candidate.durationSeconds))
          : undefined,
      note: typeof candidate.note === "string" ? candidate.note : undefined,
      externalUrl: typeof candidate.externalUrl === "string" ? candidate.externalUrl : undefined,
    });
  }

  return { attachments, invalid: false };
}

function normalizeClientMessageId(value: unknown) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized.length > 0 && normalized.length <= 160 ? normalized : undefined;
}

function normalizeMessageId(value: unknown) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized.length > 0 && normalized.length <= 160 ? normalized : "";
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  // 1. Attempt Central Chat API Engine
  try {
    const centralResult = await getCentralConversationMessages(id, new URL(request.url).searchParams);
    if (centralResult?.ok) {
      return NextResponse.json(centralResult);
    }
  } catch {
    // Gracefully proceed to live Prisma database query
  }

  // 2. Direct Live PostgreSQL Prisma Query
  const authorization = await requireSessionRole(["SUPER_ADMIN", "ADMIN", "MANAGER", "SALES_AGENT"]);
  if (!authorization.ok) {
    return authorization.response;
  }

  const tenantId = authorization.session.role === "SUPER_ADMIN" ? undefined : authorization.session.tenantId?.trim() || undefined;
  const conversation = await prisma.appConversation.findFirst({
    where: {
      id,
      ...(tenantId ? { tenantId } : {}),
    },
  });

  if (!conversation) {
    return NextResponse.json({ ok: false, conversation: null, error: "Conversation not found." }, { status: 404 });
  }

  const payload = (conversation.payload && typeof conversation.payload === "object" && !Array.isArray(conversation.payload)
    ? conversation.payload
    : {}) as Record<string, unknown>;
  const rawMessages = Array.isArray(payload.messages) ? (payload.messages as never[]) : [];

  const conversationView = mapCentralConversation(
    {
      id: conversation.id,
      customerName: conversation.customerName,
      customerPhone: conversation.customerPhone,
      status: conversation.status,
      stage: conversation.leadStatusId,
      updatedAt: conversation.updatedAt.toISOString(),
    },
    rawMessages
  );

  return NextResponse.json({
    ok: true,
    conversation: conversationView,
  });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));

  // 1. Attempt Central Dedicated API Engine
  try {
    const payload = await centralApiRequest<{ data: Record<string, unknown> }>(`/conversations/${encodeURIComponent(id)}/messages`, {
      method: "POST",
      body: JSON.stringify({
        body: typeof body?.body === "string" ? body.body : "",
        lane: body?.lane === "internal" ? "internal" : "customer",
        clientMessageId: typeof body?.clientMessageId === "string" ? body.clientMessageId : undefined,
        attachments: Array.isArray(body?.attachments) ? body.attachments : undefined,
      }),
    });
    return NextResponse.json({
      ok: true,
      conversation: mapCentralConversation({
        id,
        customerName: String(payload.data?.customerName ?? "Customer"),
        customerPhone: String(payload.data?.customerPhone ?? ""),
        lastMessage: payload.data as never,
      }, [payload.data as never]),
      message: payload.data ?? null,
      delivery: { ok: true, mode: "central-api" },
    });
  } catch {
    // Proceed to Direct Live Database Mutation
  }

  // 2. Direct Live PostgreSQL Operations
  const authorization = await requireSessionRole(["SUPER_ADMIN", "ADMIN", "MANAGER", "SALES_AGENT"]);
  if (!authorization.ok) {
    return authorization.response;
  }

  const tenantId = authorization.session.role === "SUPER_ADMIN" ? undefined : authorization.session.tenantId?.trim() || undefined;
  const conversation = await prisma.appConversation.findFirst({
    where: {
      id,
      ...(tenantId ? { tenantId } : {}),
    },
  });

  if (!conversation) {
    return NextResponse.json({ ok: false, error: "Conversation not found." }, { status: 404 });
  }

  const normalizedAttachments = normalizeAttachments(body?.attachments);
  if (normalizedAttachments.invalid) {
    return NextResponse.json({ ok: false, error: "Only files up to 20 MB are allowed." }, { status: 400 });
  }

  const role: "admin" | "manager" | "sales" =
    authorization.session.role === "MANAGER"
      ? "manager"
      : authorization.session.role === "SALES_AGENT"
        ? "sales"
        : "admin";

  const lane = body?.lane === "internal" ? "internal" : "customer";
  const transport = body?.transport === "connected_user" ? "connected_user" : "company";
  const clientMessageId = normalizeClientMessageId(body?.clientMessageId);

  const currentPayload =
    conversation.payload && typeof conversation.payload === "object" && !Array.isArray(conversation.payload)
      ? (conversation.payload as Record<string, unknown>)
      : {};
  const existingMessages = Array.isArray(currentPayload.messages) ? (currentPayload.messages as Record<string, unknown>[]) : [];

  // Handle message deletion
  if (body?.action === "delete-message") {
    const messageId = normalizeMessageId(body?.messageId);
    if (!messageId) {
      return NextResponse.json({ ok: false, error: "Message id is required." }, { status: 400 });
    }

    const messageIndex = existingMessages.findIndex((item) => item.id === messageId);
    if (messageIndex === -1) {
      return NextResponse.json({ ok: false, error: "Message not found." }, { status: 404 });
    }

    const updatedMessages = existingMessages.filter((item) => item.id !== messageId);
    await prisma.appConversation.update({
      where: { id },
      data: {
        payload: {
          ...currentPayload,
          messages: updatedMessages,
          updatedAt: new Date().toISOString(),
        } as any,
        updatedAt: new Date(),
      },
    });

    const conversationView = mapCentralConversation(
      {
        id: conversation.id,
        customerName: conversation.customerName,
        customerPhone: conversation.customerPhone,
        status: conversation.status,
        stage: conversation.leadStatusId,
        updatedAt: new Date().toISOString(),
      },
      updatedMessages as never[]
    );

    return NextResponse.json({
      ok: true,
      conversation: conversationView,
      deletedMessageId: messageId,
      scope: "everyone",
    });
  }

  // Deduplicate rapid resends
  if (clientMessageId && existingMessages.some((m) => m.clientMessageId === clientMessageId)) {
    const conversationView = mapCentralConversation(
      {
        id: conversation.id,
        customerName: conversation.customerName,
        customerPhone: conversation.customerPhone,
        status: conversation.status,
        stage: conversation.leadStatusId,
        updatedAt: conversation.updatedAt.toISOString(),
      },
      existingMessages as never[]
    );
    return NextResponse.json({
      ok: true,
      conversation: conversationView,
      delivery: { ok: true, mode: "deduped" },
    });
  }

  // Dispatch WhatsApp message if connected_user transport is selected
  let deliveryResult: { ok: boolean; messageId?: string; error?: string } = { ok: true };
  if (transport === "connected_user" && lane === "customer") {
    try {
      const delivery = await sendLinkedWhatsAppText({
        tenantId: resolveWhatsAppSetupTenantId(authorization.session),
        to: conversation.customerPhone,
        body: typeof body?.body === "string" ? body.body : "",
      });
      if (delivery.ok) {
        deliveryResult = { ok: true, messageId: delivery.messageId };
      } else {
        deliveryResult = { ok: false, error: delivery.error };
      }
    } catch (err) {
      deliveryResult = { ok: false, error: err instanceof Error ? err.message : "WhatsApp delivery failed" };
    }
  }

  const messageText = typeof body?.body === "string" ? body.body : "";
  const newMessage: Record<string, unknown> = {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    body: messageText,
    lane,
    senderRole: role,
    senderUserId: authorization.session.userId,
    senderLabel: authorization.session.displayName || "Sales closer",
    senderType: "HUMAN",
    status: deliveryResult.ok ? "sent" : "failed",
    deliveryStatus: deliveryResult.ok ? "sent" : "failed",
    deliveryError: deliveryResult.error,
    externalMessageId: deliveryResult.messageId,
    clientMessageId,
    attachments: normalizedAttachments.attachments,
    createdAt: new Date().toISOString(),
  };

  const updatedMessages = [...existingMessages, newMessage];
  await prisma.appConversation.update({
    where: { id },
    data: {
      payload: {
        ...currentPayload,
        messages: updatedMessages,
        lastMessage: newMessage,
        updatedAt: new Date().toISOString(),
      } as any,
      updatedAt: new Date(),
    },
  });

  // Realtime & Push Notifications
  await publishConversationRealtimeEvent({
    conversationId: id,
    eventType: "message-created",
    tenantId: conversation.tenantId,
    userIds: [],
  }).catch(() => undefined);

  await persistRealtimeEvent({
    topic: `tenant:${conversation.tenantId}`,
    tenantId: conversation.tenantId,
    actorUserId: authorization.session.userId,
    audienceRoles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "SALES_AGENT"],
    eventType: "message.created",
    payload: {
      conversationId: id,
      id,
      customerName: conversation.customerName,
      body: messageText,
      senderName: authorization.session.displayName ?? "Sales Closer",
      senderId: authorization.session.userId,
    },
  }).catch(() => undefined);

  const mobilePush = await sendMobileChatPushForConversation({
    conversationId: id,
    messageBody: messageText,
    messageId: String(newMessage.id),
    lane,
    senderId: authorization.session.userId,
    senderRole: role,
  }).catch((error) => ({
    error: error instanceof Error ? error.message : "Mobile push failed.",
    sent: 0,
  }));

  const conversationView = mapCentralConversation(
    {
      id: conversation.id,
      customerName: conversation.customerName,
      customerPhone: conversation.customerPhone,
      status: conversation.status,
      stage: conversation.leadStatusId,
      updatedAt: new Date().toISOString(),
    },
    updatedMessages as never[]
  );

  return NextResponse.json({
    ok: true,
    conversation: conversationView,
    delivery: deliveryResult,
    mobilePush,
  });
}
