import type { AppRole } from "@/lib/auth/types";
import { projectConversation, type DummyConversationView } from "@/lib/gigxomi/dummy-platform-store";
import { getConversationByIdFromFile, listConversationsForAudienceFromFile } from "@/lib/gigxomi/dummy-platform-file-store";

import { resolveConversationAudienceForSession, salesAgentCanAccessConversation } from "@/lib/api/conversation-access";

type ConversationSessionLike = {
  userId: string;
  role: AppRole;
  displayName: string;
  email: string | null;
  tenantId: string | null;
};

export async function getConversationViewForSession(
  session: ConversationSessionLike,
  conversationId: string,
  requestedAudience?: string | null,
): Promise<DummyConversationView | null> {
  const scope = resolveConversationAudienceForSession(session, requestedAudience);
  if (session.role === "SALES_AGENT") {
    const conversation = await getConversationByIdFromFile(conversationId);
    if (!conversation) return null;
    const effectiveSessionTenant = session.tenantId?.trim() || "tenant-gigxomi";
    const isLegacyGigxomi = effectiveSessionTenant === "tenant-gigxomi";

    const isAuthorizedTenant = isLegacyGigxomi
      ? conversation.tenantId === "tenant-gigxomi" || Boolean(conversation.tenantId?.startsWith("tenant-gigxomi-sales-agent-"))
      : conversation.tenantId === effectiveSessionTenant;

    if (!isAuthorizedTenant) return null;

    const isAssigned = await salesAgentCanAccessConversation(session.userId, conversationId);
    if (!isAssigned && !isAuthorizedTenant) return null;
    return projectConversation(conversation, "sales");
  }
  const tenantId =
    session.role === "SUPER_ADMIN"
      ? undefined
      : session.tenantId?.trim();
  if ((scope.audience === "admin" || scope.audience === "manager") && session.role !== "SUPER_ADMIN" && !tenantId) {
    return null;
  }
  const payload = await listConversationsForAudienceFromFile(scope.audience, {
    freelancerId: scope.freelancerId,
    freelancerIds: scope.freelancerIds,
    freelancerNames: scope.freelancerNames,
    activeAgencyIds: scope.activeAgencyIds,
    tenantId,
  });

  return payload.conversations.find((conversation) => conversation.id === conversationId) ?? null;
}
