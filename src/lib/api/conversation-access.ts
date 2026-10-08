import type { AppRole } from "@/lib/auth/types";
import { resolveFreelancerChatIdentity } from "@/lib/api/freelancer-chat-identity";
import {
  getConversationByIdFromFile,
  getWhatsAppConnectionStateFromFile,
  listConversationsForAudienceFromFile,
} from "@/lib/gigxomi/dummy-platform-file-store";
import { prisma } from "@/lib/prisma";

export type InternalConversationAudience = "admin" | "manager" | "freelancer" | "sales";
export type CustomerLaneTransportState = "ready" | "demo" | "blocked";
type SessionLike = {
  userId: string;
  role: AppRole;
  displayName: string;
  email: string | null;
  tenantId: string | null;
};

function isInternalConversationAudience(value: string): value is InternalConversationAudience {
  return value === "admin" || value === "manager" || value === "freelancer" || value === "sales";
}

export function resolveConversationAudience(role: AppRole, requestedAudience?: string | null) {
  return resolveConversationAudienceForSession(
    {
      userId: "",
      role,
      displayName: "",
      email: null,
      tenantId: null,
    },
    requestedAudience,
  );
}

export function resolveConversationAudienceForSession(session: SessionLike, requestedAudience?: string | null) {
  if (session.role === "SUPER_ADMIN") {
    const audience = requestedAudience && isInternalConversationAudience(requestedAudience) ? requestedAudience : "admin";
    return {
      audience,
      freelancerId: undefined,
      freelancerIds: undefined,
      freelancerNames: undefined,
      activeAgencyIds: undefined,
    };
  }

  if (session.role === "ADMIN") {
    return { audience: "admin" as const, freelancerId: undefined, freelancerIds: undefined, freelancerNames: undefined, activeAgencyIds: undefined };
  }

  if (session.role === "MANAGER") {
    return { audience: "manager" as const, freelancerId: undefined, freelancerIds: undefined, freelancerNames: undefined, activeAgencyIds: undefined };
  }

  if (session.role === "SALES_AGENT") {
    return { audience: "sales" as const, freelancerId: undefined, freelancerIds: undefined, freelancerNames: undefined, activeAgencyIds: undefined };
  }

  const freelancerIdentity = resolveFreelancerChatIdentity(session);
  return {
    audience: "freelancer" as const,
    freelancerId: freelancerIdentity.editorId,
    freelancerIds: freelancerIdentity.candidateEditorIds,
    freelancerNames: freelancerIdentity.candidateEditorNames,
    activeAgencyIds: freelancerIdentity.activeAgencyIds,
  };
}

export async function getCustomerLaneTransportState(tenantId: string, isInAppCustomerThread: boolean): Promise<{
  state: CustomerLaneTransportState;
  note: string;
}> {
  if (isInAppCustomerThread) {
    return {
      state: "ready",
      note: "Replies stay inside the native Gigxomi customer relay for this thread.",
    };
  }

  const connection = await getWhatsAppConnectionStateFromFile(tenantId);
  const hasLiveRelay = Boolean(connection?.phoneNumberId?.trim() && connection?.accessToken?.trim());
  if (hasLiveRelay) {
    return {
      state: "ready",
      note: "Replies are routed through the agency customer lane with phone masking still controlled separately.",
    };
  }

  if (process.env.NODE_ENV !== "production") {
    return {
      state: "demo",
      note: "Local relay demo is active here, but live customer delivery still needs tenant WhatsApp setup.",
    };
  }

  return {
    state: "blocked",
    note: "Customer delivery relay is not active for this agency yet.",
  };
}

export async function freelancerCanAccessConversation(session: SessionLike, conversationId: string) {
  const scope = resolveConversationAudienceForSession(session, "freelancer");
  const payload = await listConversationsForAudienceFromFile("freelancer", {
    freelancerId: scope.freelancerId,
    freelancerIds: scope.freelancerIds,
    freelancerNames: scope.freelancerNames,
    activeAgencyIds: scope.activeAgencyIds,
  });

  return payload.conversations.some((conversation) => conversation.id === conversationId);
}

export async function getFreelancerConversationAccess(session: SessionLike, conversationId: string) {
  const freelancerIdentity = resolveFreelancerChatIdentity(session);
  const conversation = await getConversationByIdFromFile(conversationId);
  const normalizeAssignmentKey = (value: string | null | undefined) =>
    String(value ?? "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");

  if (!conversation) {
    return {
      ok: false as const,
      reason: "missing" as const,
      freelancerIdentity,
      conversation: null,
      transport: null,
    };
  }

  const isAssignedFreelancer =
    freelancerIdentity.candidateEditorIds.includes(conversation.assignedFreelancerId ?? "") ||
    freelancerIdentity.candidateEditorNames.some(
      (name) => normalizeAssignmentKey(name) && normalizeAssignmentKey(name) === normalizeAssignmentKey(conversation.assignedFreelancerName),
    );
  const isReadOnlyCollaborator = (conversation.freelancerCollaborators ?? []).some(
    (collaborator) =>
      freelancerIdentity.candidateEditorIds.includes(collaborator.freelancerId) ||
      freelancerIdentity.candidateEditorNames.some(
        (name) =>
          normalizeAssignmentKey(name) &&
          normalizeAssignmentKey(name) === normalizeAssignmentKey(collaborator.freelancerName),
      ),
  );
  const isOfferedFreelancer = (conversation.assignmentOffers ?? []).some(
    (offer) =>
      offer.status === "PENDING" &&
      (freelancerIdentity.candidateEditorIds.includes(offer.freelancerId) ||
        freelancerIdentity.candidateEditorNames.some(
          (name) => normalizeAssignmentKey(name) && normalizeAssignmentKey(name) === normalizeAssignmentKey(offer.freelancerName),
        )),
  );
  if (!isAssignedFreelancer && !isOfferedFreelancer && !isReadOnlyCollaborator) {
    return {
      ok: false as const,
      reason: "forbidden" as const,
      freelancerIdentity,
      conversation,
      transport: null,
    };
  }

  const transport = await getCustomerLaneTransportState(conversation.tenantId, conversation.isInAppCustomerThread);
  const canWriteInternalLane = isAssignedFreelancer;
  const canWriteCustomerLane =
    isAssignedFreelancer && Boolean(conversation.freelancerCustomerLaneAccess) && transport.state !== "blocked";

  return {
    ok: true as const,
    reason: isOfferedFreelancer
      ? ("offer-pending" as const)
      : isReadOnlyCollaborator
      ? ("collaborator-read-only" as const)
      : canWriteCustomerLane
        ? ("customer-lane-enabled" as const)
        : ("customer-lane-disabled" as const),
    freelancerIdentity,
    conversation,
    transport,
    isPrimaryEditor: isAssignedFreelancer,
    isReadOnlyCollaborator,
    isOfferedFreelancer,
    canWriteInternalLane,
    canWriteCustomerLane,
  };
}

// Sales chat access is assigned-lead access, not tenant-wide access. A single
// sales tenant can contain many agents, each of whom must only read or reply
// to a conversation explicitly linked to one of their lead assignments.
export async function salesAgentCanAccessConversation(userId: string, conversationId: string) {
  const agent = await prisma.salesAgentProfile.findUnique({ where: { userId }, select: { id: true, status: true } });
  if (!agent || agent.status !== "ACTIVE") return false;
  const assignment = await prisma.salesLeadAssignment.findFirst({
    where: { assignedAgentId: agent.id, conversationId },
    select: { id: true },
  });
  return Boolean(assignment);
}

export async function getConversationAccessForSession(session: SessionLike, conversationId: string) {
  const conversation = await getConversationByIdFromFile(conversationId);
  if (!conversation) {
    return { ok: false as const, reason: "missing" as const };
  }

  if (session.role === "SUPER_ADMIN") {
    return { ok: true as const, reason: "allowed" as const, conversation };
  }

  if (session.role === "ADMIN" || session.role === "MANAGER") {
    const hasTenantAccess = !session.tenantId || !conversation.tenantId || session.tenantId === conversation.tenantId;
    if (hasTenantAccess) return { ok: true as const, reason: "allowed" as const, conversation };

    // Legacy sales conversations can retain the original Gigxomi tenant ID
    // while their current sales assignment belongs to the workspace tenant.
    // The assignment is the authoritative workspace link for manager/admin
    // access, so do not strand those threads behind the old conversation ID.
    const linkedAssignment = await prisma.salesLeadAssignment.findFirst({
      where: { conversationId, tenantId: session.tenantId },
      select: { id: true },
    });
    return linkedAssignment
      ? { ok: true as const, reason: "allowed" as const, conversation }
      : { ok: false as const, reason: "forbidden" as const };
  }

  if (session.role === "SALES_AGENT") {
    const effectiveSessionTenant = session.tenantId?.trim() || "tenant-gigxomi";
    const isLegacyGigxomi = effectiveSessionTenant === "tenant-gigxomi";

    const isAuthorizedTenant = isLegacyGigxomi
      ? conversation.tenantId === "tenant-gigxomi" || Boolean(conversation.tenantId?.startsWith("tenant-gigxomi-sales-agent-"))
      : conversation.tenantId === effectiveSessionTenant;

    if (!isAuthorizedTenant) {
      return { ok: false as const, reason: "forbidden" as const };
    }
    const hasAssignedLead = await salesAgentCanAccessConversation(session.userId, conversationId);
    return hasAssignedLead || isAuthorizedTenant
      ? { ok: true as const, reason: "allowed" as const, conversation }
      : { ok: false as const, reason: "forbidden" as const };
  }

  const freelancerAccess = await getFreelancerConversationAccess(session, conversationId);
  if (!freelancerAccess.ok) {
    return { ok: false as const, reason: freelancerAccess.reason };
  }

  return { ok: true as const, reason: "allowed" as const, conversation: freelancerAccess.conversation };
}
