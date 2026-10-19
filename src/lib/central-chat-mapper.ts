export type DummyConversationLane = "customer" | "internal";
export type DummyConversationRole = "customer" | "manager" | "admin" | "freelancer" | "sales" | "ai";

export type DummyConversationMessage = {
  id: string;
  lane: DummyConversationLane;
  senderRole: DummyConversationRole;
  senderLabel: string;
  body: string;
  externalMessageId?: string;
  deliveryStatus?: "failed" | "sent" | "delivered" | "read";
  attachments?: Array<{
    id?: string;
    name?: string;
    mimeType?: string;
    sizeBytes?: number;
    externalUrl?: string;
    uploadTarget: "local";
  }>;
  createdAt: string;
};

export type DummyConversationView = {
  id: string;
  leadId?: string;
  contactId: string;
  serviceId: string;
  serviceSlug: string;
  serviceTitle: string;
  customerDisplayName: string;
  customerPhone: string;
  customerPhoneDisplay: string;
  lastActivityAt: string;
  sourceChannel: "whatsapp" | "instagram" | "in-app";
  externalSourceType?: string;
  externalSourceLabel: string;
  summary: string;
  status: "Active" | "Closed";
  leadStatusId: string;
  leadStatusLabel: string;
  leadStatusTone: "neutral" | "accent" | "warning" | "success";
  unreadCount: number;
  unread: boolean;
  messages: DummyConversationMessage[];
};

export type CentralChatMessage = {
  id?: string;
  body?: string;
  lane?: string;
  senderRole?: string;
  senderLabel?: string;
  createdAt?: string;
  externalMessageId?: string;
  status?: string;
  attachments?: Array<{
    id?: string;
    name?: string;
    mimeType?: string;
    sizeBytes?: number;
    url?: string;
    externalUrl?: string;
  }>;
};

export type CentralConversationRecord = {
  id: string;
  customerName?: string;
  customerPhone?: string;
  status?: string;
  channel?: string;
  sourceChannel?: string;
  stage?: string;
  leadStage?: string;
  leadId?: string | null;
  assignedAgent?: { id?: string; displayName?: string } | null;
  unreadCount?: number;
  lastMessage?: CentralChatMessage | null;
  updatedAt?: string;
};

function stageLabel(stage: string) {
  return stage.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export function mapCentralConversation(
  conversation: CentralConversationRecord,
  messages: CentralChatMessage[] = []
): DummyConversationView {
  const stage = conversation.leadStage || conversation.stage || "NEW";
  const channel = String(conversation.channel || conversation.sourceChannel || "whatsapp").toLowerCase();
  const sourceChannel = channel.includes("instagram") ? "instagram" : channel.includes("in-app") ? "in-app" : "whatsapp";
  const unreadCount = Number(conversation.unreadCount ?? 0);
  const lastActivity = conversation.lastMessage?.createdAt ?? conversation.updatedAt ?? new Date().toISOString();

  return {
    id: conversation.id,
    leadId: conversation.leadId ?? undefined,
    contactId: conversation.leadId ?? conversation.id,
    serviceId: "svc-central-crm",
    serviceSlug: "central-crm",
    serviceTitle: "AI Closer CRM",
    customerDisplayName: conversation.customerName ?? "Unknown customer",
    customerPhone: conversation.customerPhone ?? "",
    customerPhoneDisplay: conversation.customerPhone ?? "",
    lastActivityAt: lastActivity,
    sourceChannel,
    externalSourceType: sourceChannel === "whatsapp" ? "company_whatsapp" : undefined,
    externalSourceLabel: sourceChannel === "whatsapp" ? "WhatsApp API" : sourceChannel,
    summary: conversation.lastMessage?.body ?? "No messages yet",
    status: conversation.status === "CLOSED" ? "Closed" : "Active",
    leadStatusId: stage.toLowerCase().replace(/[\s_]+/g, "-"),
    leadStatusLabel: stageLabel(stage),
    leadStatusTone: "accent",
    unreadCount,
    unread: unreadCount > 0,
    messages: messages.map((m) => ({
      id: m.id || `msg-${Date.now()}`,
      lane: (m.lane === "internal" ? "internal" : "customer") as DummyConversationLane,
      senderRole: (m.senderRole === "customer" ? "customer" : m.senderRole === "ai" ? "ai" : "sales") as DummyConversationRole,
      senderLabel: m.senderLabel || "Sales agent",
      body: m.body ?? "",
      externalMessageId: m.externalMessageId,
      createdAt: m.createdAt ?? new Date().toISOString(),
    })),
  };
}
