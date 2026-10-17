import type {
  DummyConversationLane,
  DummyConversationMessage,
  DummyConversationRole,
  DummyConversationView,
} from "@/lib/gigxomi/dummy-platform-store";

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
  return stage.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (character) => character.toUpperCase());
}

const CENTRAL_STAGE_UI_MAP: Record<string, { id: string; label: string; tone: "neutral" | "accent" | "warning" | "success" }> = {
  NEW: { id: "new", label: "New Leads", tone: "accent" },
  ASSIGNED: { id: "assigned", label: "Assigned", tone: "accent" },
  CONTACTED: { id: "contacted", label: "Contacted", tone: "accent" },
  QUALIFIED: { id: "in-progress", label: "In Progress", tone: "success" },
  INTERESTED: { id: "in-progress", label: "In Progress", tone: "success" },
  IN_PROGRESS: { id: "in-progress", label: "In Progress", tone: "success" },
  WEBINAR_INVITED: { id: "demo-booked", label: "Demo Booked", tone: "warning" },
  WEBINAR_ATTENDED: { id: "demo-booked", label: "Demo Booked", tone: "warning" },
  DEMO_SCHEDULED: { id: "demo-booked", label: "Demo Booked", tone: "warning" },
  FOLLOW_UP: { id: "follow-up", label: "Follow Up", tone: "warning" },
  CLOSED: { id: "closed", label: "Closed Won", tone: "success" },
  CLOSED_WON: { id: "closed", label: "Closed Won", tone: "success" },
  CLOSED_LOST: { id: "lost", label: "Lost / Recycled", tone: "neutral" },
  LOST: { id: "lost", label: "Lost / Recycled", tone: "neutral" },
};

export function getCentralStageUi(stage?: string | null) {
  const raw = String(stage || "NEW").trim();
  const key = raw.toUpperCase().replace(/[\s-]+/g, "_");
  return CENTRAL_STAGE_UI_MAP[key] ?? {
    id: raw.toLowerCase().replace(/[\s_]+/g, "-"),
    label: stageLabel(raw),
    tone: "neutral" as const,
  };
}

export function toCentralStageValue(stage?: string | null) {
  const value = String(stage || "NEW").trim();
  const uiToCentral: Record<string, string> = {
    new: "NEW",
    assigned: "ASSIGNED",
    contacted: "CONTACTED",
    qualified: "INTERESTED",
    "in-progress": "INTERESTED",
    "training-booked": "WEBINAR_INVITED",
    "demo-booked": "WEBINAR_INVITED",
    in_progress: "INTERESTED",
    demo_scheduled: "WEBINAR_INVITED",
    "follow-up": "FOLLOW_UP",
    closed: "CLOSED_WON",
    lost: "CLOSED_LOST",
  };
  return uiToCentral[value.toLowerCase()] ?? value.replace(/[\s-]+/g, "_").toUpperCase();
}

function mapMessage(message: CentralChatMessage): DummyConversationMessage {
  const senderRole: DummyConversationRole = message.senderRole === "customer" ? "customer" : message.senderRole === "ai" ? "ai" : "sales";
  const lane: DummyConversationLane = message.lane === "internal" ? "internal" : "customer";
  const deliveryStatus = ["failed", "sent", "delivered", "read"].includes(message.status ?? "")
    ? message.status as "failed" | "sent" | "delivered" | "read"
    : undefined;
  return {
    id: message.id || `message-${message.createdAt || Date.now()}`,
    lane,
    senderRole,
    senderLabel: message.senderLabel || (senderRole === "customer" ? "Customer" : senderRole === "ai" ? "AI Closer" : "Sales agent"),
    body: message.body ?? "",
    externalMessageId: message.externalMessageId,
    deliveryStatus,
    attachments: (message.attachments ?? []).map((attachment) => ({
      id: attachment.id,
      name: attachment.name ?? "Attachment",
      mimeType: attachment.mimeType,
      sizeBytes: attachment.sizeBytes,
      externalUrl: attachment.externalUrl ?? attachment.url,
      uploadTarget: "local" as const,
    })),
    createdAt: message.createdAt ?? new Date().toISOString(),
  };
}

export function mapCentralConversation(
  conversation: CentralConversationRecord,
  messages: CentralChatMessage[] = [],
): DummyConversationView {
  const stage = conversation.leadStage || conversation.stage || "NEW";
  const stageUi = getCentralStageUi(stage);
  const mappedMessages = messages.map(mapMessage);
  const lastMessage = conversation.lastMessage || messages[messages.length - 1] || null;
  const summary = lastMessage?.body ?? "No messages yet";
  const channel = String(conversation.channel || conversation.sourceChannel || "whatsapp").toLowerCase();
  const sourceChannel = channel.includes("instagram") ? "instagram" : channel.includes("in-app") ? "in-app" : "whatsapp";
  const unreadCount = Number(conversation.unreadCount ?? 0);
  const lastActivity = lastMessage?.createdAt ?? conversation.updatedAt ?? new Date().toISOString();

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
    summary,
    status: conversation.status === "CLOSED" ? "Closed" : "Active",
    leadStatusId: stageUi.id,
    leadStatusLabel: stageUi.label,
    leadStatusTone: stageUi.tone,
    visibleLanes: ["customer", "internal"],
    messages: mappedMessages,
    typing: [],
    laneCounts: {
      customer: mappedMessages.filter((message) => message.lane === "customer").length,
      internal: mappedMessages.filter((message) => message.lane === "internal").length,
    },
    unreadCount,
    unreadCountByLane: { customer: unreadCount, internal: 0 },
    readStateByAudience: {},
    latestMessageLane: "customer",
    preferredLane: "customer",
    internalNotes: "",
    isInAppCustomerThread: false,
    lastCustomerActivityAt: lastActivity,
    updatedAt: conversation.updatedAt ?? lastActivity,
    assignedFreelancerName: conversation.assignedAgent?.displayName,
    assignedFreelancerId: conversation.assignedAgent?.id,
    assignmentSummary: {
      assignedFreelancerId: conversation.assignedAgent?.id,
      assignedFreelancerName: conversation.assignedAgent?.displayName,
    },
    laneCapabilities: {
      customer: { visible: true, writable: true },
      internal: { visible: true, writable: true },
    },
    leadStage: stage,
  };
}
