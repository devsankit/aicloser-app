import "server-only";

import { EventEmitter } from "node:events";

import { listRealtimeEvents, persistRealtimeEvent } from "@/lib/realtime/event-outbox";

type ConversationRealtimeSession = {
  role: string;
  tenantId?: string | null;
  userId: string;
};

export type ConversationRealtimeEvent = {
  conversationId: string;
  createdAt: string;
  eventType: "conversation-updated" | "message-created" | "conversation-read";
  tenantId?: string | null;
  userIds?: string[];
};

const CONVERSATION_REALTIME_TOPIC = "chat.conversations";

const globalForConversationRealtime = globalThis as typeof globalThis & {
  __gigxomiConversationEmitter?: EventEmitter;
};

function getEmitter() {
  if (!globalForConversationRealtime.__gigxomiConversationEmitter) {
    const emitter = new EventEmitter();
    emitter.setMaxListeners(500);
    globalForConversationRealtime.__gigxomiConversationEmitter = emitter;
  }

  return globalForConversationRealtime.__gigxomiConversationEmitter;
}

function normalizeUserIds(userIds?: Array<string | null | undefined>) {
  return Array.from(new Set((userIds ?? []).map((userId) => userId?.trim()).filter(Boolean) as string[]));
}

export async function publishConversationRealtimeEvent(
  event: Omit<ConversationRealtimeEvent, "createdAt"> & { createdAt?: string },
) {
  const normalizedEvent: ConversationRealtimeEvent = {
    ...event,
    createdAt: event.createdAt ?? new Date().toISOString(),
    userIds: normalizeUserIds(event.userIds),
  };

  await persistRealtimeEvent({
    audienceUserIds: normalizedEvent.userIds,
    audienceRoles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "FREELANCER"],
    eventType: normalizedEvent.eventType,
    payload: normalizedEvent,
    tenantId: normalizedEvent.tenantId ?? null,
    topic: CONVERSATION_REALTIME_TOPIC,
  }).catch(() => {
    // Keep live in-process events working during deploys where the durable outbox is unavailable.
  });

  getEmitter().emit("conversation", normalizedEvent);
  return normalizedEvent;
}

export function subscribeConversationRealtimeEvents(listener: (event: ConversationRealtimeEvent) => void) {
  const emitter = getEmitter();
  emitter.on("conversation", listener);
  return () => emitter.off("conversation", listener);
}

export function canReceiveConversationRealtimeEvent(event: ConversationRealtimeEvent, session: ConversationRealtimeSession) {
  const targetUserIds = normalizeUserIds(event.userIds);
  if (targetUserIds.length) return targetUserIds.includes(session.userId);
  if (session.role === "SUPER_ADMIN") return true;
  return Boolean(event.tenantId && session.tenantId && event.tenantId === session.tenantId);
}

export async function listRecentConversationRealtimeEvents(session: ConversationRealtimeSession) {
  const rows = await listRealtimeEvents<ConversationRealtimeEvent>({
    limit: 40,
    topic: CONVERSATION_REALTIME_TOPIC,
  }).catch(() => []);

  return rows.map((row) => row.payload).filter((event) => canReceiveConversationRealtimeEvent(event, session));
}
