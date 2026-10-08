import type { AppRole } from "@/lib/auth/types";
import { projectConversation, type DummyConversationView } from "@/lib/gigxomi/dummy-platform-store";
import { getConversationByIdFromFile, listConversationsForAudienceFromFile } from "@/lib/gigxomi/dummy-platform-file-store";
import { prisma } from "@/lib/prisma";

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

  const listedConversation = payload.conversations.find((conversation) => conversation.id === conversationId);
  if (listedConversation) return listedConversation;

  // Some legacy threads keep the original conversation audience/tenant in
  // the file projection while the current sales assignment carries the
  // workspace tenant. Keep the manager/admin mobile inbox and chat view
  // consistent by accepting that assignment link as the authoritative scope.
  if ((session.role === "ADMIN" || session.role === "MANAGER") && tenantId) {
    const linkedAssignment = await prisma.salesLeadAssignment.findFirst({
      where: { conversationId, tenantId },
      select: { id: true },
    });
    if (linkedAssignment) {
      const conversation = await getConversationByIdFromFile(conversationId);
      return conversation ? projectConversation(conversation, scope.audience) : null;
    }
  }

  return null;
}
