import { centralApiRequest } from "@/lib/central-api-server";
import { mapCentralConversation, type CentralChatMessage, type CentralConversationRecord } from "@/lib/central-chat-mapper";

export { mapCentralConversation } from "@/lib/central-chat-mapper";
type CentralConversation = CentralConversationRecord & { payload?: { messages?: CentralChatMessage[] } };

export async function getCentralConversations(params: URLSearchParams) {
  const query = new URLSearchParams();
  const page = params.get("page") || "1";
  const limit = params.get("limit") || "100";
  query.set("page", page);
  query.set("limit", limit);
  for (const key of ["search", "status"]) {
    const value = params.get(key);
    if (value) query.set(key, value);
  }
  const payload = await centralApiRequest<{ data: CentralConversation[] | { conversations?: CentralConversation[]; pagination?: unknown }; pagination?: unknown }>(`/conversations?${query.toString()}`);
  const data = Array.isArray(payload.data) ? payload.data : (payload.data?.conversations ?? []);
  const pagination = Array.isArray(payload.data) ? payload.pagination : payload.data?.pagination;
  return {
    ok: true,
    supportDataIncluded: false,
    conversations: data.map((conversation) => mapCentralConversation(conversation, conversation.payload?.messages ?? [])),
    assignableEditors: [],
    leadStatuses: [],
    templates: [],
    pagination,
  };
}

export async function getCentralConversationMessages(id: string, searchParams: URLSearchParams) {
  const query = new URLSearchParams();
  const before = searchParams.get("before");
  if (before) query.set("before", before);
  query.set("limit", searchParams.get("limit") || "50");
  const payload = await centralApiRequest<{ data: CentralConversation }>(`/conversations/${encodeURIComponent(id)}?${query.toString()}`);
  const conversation = payload.data;
  return {
    ok: true,
    conversation: mapCentralConversation(conversation, conversation.payload?.messages ?? []),
    pagination: undefined,
  };
}
