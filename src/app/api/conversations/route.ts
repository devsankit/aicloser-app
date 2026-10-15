import { NextResponse } from "next/server";

import { resolveConversationAudienceForSession } from "@/lib/api/conversation-access";
import {
  getSalesAgentAssignedConversationIds,
  getSalesAgentAssignedScope,
  showOnlyAssignedChatsForTenant,
} from "@/lib/api/sales-chat-visibility";
import { requireSessionRole } from "@/lib/api/require-session-role";
import type { ManagedAuthUser } from "@/lib/auth/types";
import type { WorkloadBand } from "@/lib/gigxomi/business-ecosystem-data";
import {
  deleteConversationFromFile,
  listConversationsForAudienceFromFile,

} from "@/lib/gigxomi/dummy-platform-file-store";
import type { DummyLeadStatusTone } from "@/lib/gigxomi/dummy-platform-store";
import { crmStatuses } from "@/lib/gigxomi/crm-data";
import { getManagedAuthUsers } from "@/lib/auth/store";
import { prisma } from "@/lib/prisma";
import { POST as syncWhatsAppScanner } from "@/app/api/sales/whatsapp-scanner/route";

const whatsappInboxSyncs = new Map<string, Promise<unknown>>();
const whatsappInboxSyncAt = new Map<string, number>();

async function syncConnectedWhatsAppInbox(request: Request, userId: string) {
  const now = Date.now();
  const previous = whatsappInboxSyncs.get(userId);
  if (previous) {
    await previous.catch(() => undefined);
    return;
  }
  if (now - (whatsappInboxSyncAt.get(userId) ?? 0) < 10_000) return;

  const headers = new Headers();
  const cookie = request.headers.get("cookie");
  if (cookie) headers.set("cookie", cookie);
  const sync = syncWhatsAppScanner(
    new Request(new URL("/api/sales/whatsapp-scanner", request.url), {
      method: "POST",
      headers,
      body: JSON.stringify({ action: "complete_scan", syncMode: "FULL_INBOX_SYNC" }),
    }),
  ).catch(() => undefined);
  whatsappInboxSyncs.set(userId, sync);
  whatsappInboxSyncAt.set(userId, now);
  try {
    await sync;
  } finally {
    whatsappInboxSyncs.delete(userId);
  }
}

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function number(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function list(value: unknown) {
  return Array.isArray(value) ? value.map(text).filter(Boolean) : [];
}

function workloadBand(value: unknown): WorkloadBand {
  const normalized = text(value).toLowerCase();
  if (normalized.includes("near") || normalized.includes("full")) return "Near Capacity";
  if (normalized.includes("busy") || normalized.includes("heavy")) return "Busy";
  if (normalized.includes("low") || normalized.includes("light") || normalized.includes("available")) return "Low";
  return "Moderate";
}

export async function GET(request: Request) {
  const authorization = await requireSessionRole(["SUPER_ADMIN", "ADMIN", "MANAGER", "FREELANCER", "SALES_AGENT"]);
  if (!authorization.ok) {
    return authorization.response;
  }

  const { searchParams } = new URL(request.url);
  const requestedAudience = searchParams.get("audience");
  const includeSupportData = searchParams.get("includeSupportData") !== "0";
  const serviceId = searchParams.get("serviceId")?.trim() || undefined;
  const conversationId = searchParams.get("conversationId")?.trim() || undefined;
  const requestedLimit = Number(searchParams.get("limit") ?? "");
  const limit = Number.isFinite(requestedLimit) && requestedLimit > 0 ? Math.min(Math.floor(requestedLimit), 1000) : undefined;

  if (requestedAudience === "customer") {
    return NextResponse.json({ ok: false, error: "The in-app customer route has been retired. Use WhatsApp-first intake instead." }, { status: 410 });
  }

  if (requestedAudience && requestedAudience !== "manager" && requestedAudience !== "admin" && requestedAudience !== "freelancer" && requestedAudience !== "sales") {
    return NextResponse.json({ ok: false, error: "Unsupported conversation audience." }, { status: 400 });
  }

  const explicitTenantId = searchParams.get("tenantId")?.trim() || undefined;
  const scope = resolveConversationAudienceForSession(authorization.session, requestedAudience);
  const tenantId =
    authorization.session.role === "SUPER_ADMIN"
      ? (explicitTenantId || "tenant-gigxomi")
      : authorization.session.role === "SALES_AGENT"
        // The sales inbox is a shared workspace view. A sales agent's
        // personal WhatsApp setup tenant is only for channel configuration;
        // it must not hide conversations stored under the workspace tenant.
        ? (authorization.session.tenantId?.trim() || explicitTenantId)
        : (authorization.session.tenantId?.trim() || explicitTenantId);
  if ((scope.audience === "admin" || scope.audience === "manager") && authorization.session.role !== "SUPER_ADMIN" && !tenantId) {
    return NextResponse.json({ ok: false, error: "This account is not attached to an agency workspace yet." }, { status: 403 });
  }

  // A linked personal/business WhatsApp produces events in the Baileys
  // service cache. Reconcile that cache into the workspace inbox before the
  // list is read, so opening/refreshing Chat is enough to see new messages.
  if (scope.audience === "sales") {
    await syncConnectedWhatsAppInbox(request, authorization.session.userId);
  }

  const payload = await listConversationsForAudienceFromFile(scope.audience, {
    freelancerId: scope.freelancerId,
    freelancerIds: scope.freelancerIds,
    freelancerNames: scope.freelancerNames,
    activeAgencyIds: scope.activeAgencyIds,
    tenantId,
    includeSupportData,
    serviceId,
    conversationId,
    limit,
  });

  let visibleConversations = payload.conversations;

  // 1. Admin / Manager switching to inspect a specific agent's inbox
  const requestedAgentId = searchParams.get("agentId")?.trim() || searchParams.get("selectedAgentId")?.trim();
  if ((scope.audience === "admin" || scope.audience === "manager") && requestedAgentId && requestedAgentId !== "all") {
    const agentScope = await getSalesAgentAssignedScope(requestedAgentId);
    visibleConversations = visibleConversations.filter((conversation) => {
      if (agentScope.conversationIds.has(conversation.id)) return true;
      const last10 = conversation.customerPhone?.replace(/\D/g, "").slice(-10);
      if (last10 && agentScope.phones.has(last10)) return true;
      if (conversation.externalSourceType === "whatsapp_personal") {
        const sourcePhone = (conversation.externalSourcePhone || (conversation as { sourcePhone?: string }).sourcePhone || "").replace(/\D/g, "").slice(-10);
        if (agentScope.connectedPhone && sourcePhone && agentScope.connectedPhone === sourcePhone) {
          return true;
        }
      }
      return false;
    });
  }

  // 2. Strict access enforcement for Sales Agents
  if (scope.audience === "sales" && authorization.session.role === "SALES_AGENT" && tenantId) {
    const assignedOnly = await showOnlyAssignedChatsForTenant(tenantId);
    if (assignedOnly) {
      const agentScope = await getSalesAgentAssignedScope(authorization.session.userId);
      visibleConversations = visibleConversations.filter((conversation) => {
        // Direct assignment match
        if (agentScope.conversationIds.has(conversation.id)) return true;
        // Phone number matches assigned lead in CRM
        const last10 = conversation.customerPhone?.replace(/\D/g, "").slice(-10);
        if (last10 && agentScope.phones.has(last10)) return true;
        // Personal WhatsApp: ONLY show if it belongs to this agent's connected phone line
        if (conversation.externalSourceType === "whatsapp_personal") {
          const sourcePhone = (conversation.externalSourcePhone || (conversation as { sourcePhone?: string }).sourcePhone || "").replace(/\D/g, "").slice(-10);
          if (agentScope.connectedPhone && sourcePhone && agentScope.connectedPhone === sourcePhone) {
            return true;
          }
        }
        // Disallow any other conversation (including other agents' personal/business WhatsApp)
        return false;
      });
      if (conversationId && visibleConversations.length === 0) {
        return NextResponse.json({ ok: false, error: "This chat is not assigned to your account." }, { status: 403 });
      }
    }
  }

  let assignableEditors = payload.assignableEditors;
  if (includeSupportData && (scope.audience === "admin" || scope.audience === "manager")) {
    const [managedUsers, salesAgentProfiles] = await Promise.all([
      getManagedAuthUsers(),
      tenantId
        ? prisma.salesAgentProfile.findMany({
            where: { tenantId, status: "ACTIVE" },
            select: { userId: true, user: { select: { displayName: true, lastLoginAt: true } } },
          })
        : Promise.resolve([]),
    ]);

    const salesProfilesByUserId = new Map(
      salesAgentProfiles.map((profile) => [profile.userId, profile]),
    );

    assignableEditors = managedUsers
      .filter((user) => salesProfilesByUserId.has(user.id) || user.role === "ADMIN" || user.role === "MANAGER" || user.role === "SALES_AGENT")
      .map((user) => {
        const profile = salesProfilesByUserId.get(user.id);
        const isOnline = Boolean(user.lastLoginAt && new Date(user.lastLoginAt).getTime() >= Date.now() - 15 * 60 * 1000);
        return {
          id: user.id,
          name: user.displayName || profile?.user.displayName || "Sales Agent",
          specialties: ["Sales Agent", "CRM Follow-up"],
          workloadBand: "Moderate" as WorkloadBand,
          karmaScore: 0,
          onlineStatus: isOnline ? ("online" as const) : ("offline" as const),
          lastOnlineAt: user.lastLoginAt,
          acceptingProjects: true,
          isTeamMember: true,
          offerEligible: true,
          directAssignmentEligible: true,
          verificationStatus: "ACTIVE",
          startingPrice: null,
          portfolioLinks: [],
          services: [],
        };
      })
      .filter((editor, index, editors) => editors.findIndex((candidate) => candidate.id === editor.id) === index);
  }

  // Enrich conversations with Customer 360 / Registration details for sales closer
  let enrichedConversations = visibleConversations ?? [];
  if (Array.isArray(enrichedConversations) && enrichedConversations.length > 0) {
    try {
      const phoneDigitsList = enrichedConversations
        .map((c) => (c.customerPhoneDisplay || "").replace(/\D/g, "").slice(-10))
        .filter(Boolean);

      const [dbUsers, dbLeads] = await Promise.all([
        phoneDigitsList.length
          ? prisma.appAuthUser.findMany({
              where: {
                OR: [
                  ...phoneDigitsList.map((digits) => ({ phone: { contains: digits } })),
                  ...phoneDigitsList.map((digits) => ({ loginPhoneAliases: { has: digits } })),
                ],
              },
              select: {
                id: true,
                displayName: true,
                phone: true,
                role: true,
                packageAudience: true,
                packageName: true,
                packageStatus: true,
                packageExpiresAt: true,
              },
            })
          : [],
        phoneDigitsList.length
          ? prisma.salesLeadAssignment.findMany({
              where: {
                OR: [
                  ...phoneDigitsList.map((digits) => ({ customerPhone: { contains: digits } })),
                  { conversationId: { in: enrichedConversations.map((c) => c.id) } },
                ],
              },
              select: {
                conversationId: true,
                customerPhone: true,
                customerName: true,
                stage: true,
                priority: true,
              },
            })
          : [],
      ]);

      const userIds = dbUsers.map((u) => u.id);
      const pushTokens = userIds.length
        ? await prisma.devicePushToken.findMany({
            where: { userId: { in: userIds }, isActive: true },
            select: { userId: true },
          })
        : [];
      const installedUserIds = new Set(pushTokens.map((t: { userId: string }) => t.userId));

      enrichedConversations = enrichedConversations.map((conv) => {
        const digits = (conv.customerPhoneDisplay || "").replace(/\D/g, "").slice(-10);
        const matchedUser = digits
          ? dbUsers.find((u) => (u.phone || "").replace(/\D/g, "").slice(-10) === digits)
          : null;
        const matchedLead =
          dbLeads.find((l) => l.conversationId === conv.id) ||
          (digits ? dbLeads.find((l) => (l.customerPhone || "").replace(/\D/g, "").slice(-10) === digits) : null);

        // Better display name: If current name is unknown or default or an LID, use matched user or lead name or formatted phone
        const rawName = (conv.customerDisplayName || "").trim();
        const rawDigits = rawName.replace(/\D/g, "");
        const isLid = rawDigits.length >= 13 && (rawName.startsWith("+") || /^\d+$/.test(rawName));
        const isDefaultOrUnknown =
          !rawName ||
          rawName.toLowerCase() === "unknown customer" ||
          rawName.toLowerCase() === "whatsapp customer" ||
          rawName.toLowerCase() === "customer" ||
          rawName.includes('"deviceId"') ||
          isLid;

        const formattedPhone = digits && digits.length === 10
          ? `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`
          : (conv.customerPhoneDisplay && conv.customerPhoneDisplay.replace(/\D/g, "").length <= 12
              ? conv.customerPhoneDisplay
              : "");

        const realName =
          (isDefaultOrUnknown ? matchedUser?.displayName || matchedLead?.customerName : null) ||
          (!isDefaultOrUnknown ? rawName : null) ||
          matchedUser?.displayName ||
          matchedLead?.customerName ||
          formattedPhone ||
          "WhatsApp Contact";

        const accountType: "LEAD" = "LEAD";

        const expiresAt = matchedUser?.packageExpiresAt ? new Date(matchedUser.packageExpiresAt) : null;
        const planDaysRemaining = expiresAt
          ? Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
          : null;

        const stageToConvStatus: Record<string, { id: string; label: string; tone: DummyLeadStatusTone }> = {
          NEW: { id: "new", label: "New Lead", tone: "accent" },
          CONTACTED: { id: "contacted", label: "Contacted", tone: "accent" },
          INTERESTED: { id: "qualified", label: "Interested / Qualified", tone: "success" },
          WEBINAR_INVITED: { id: "training-booked", label: "Training Booked", tone: "accent" },
          FOLLOW_UP: { id: "follow-up", label: "Follow-up", tone: "warning" },
          CLOSED_WON: { id: "closed", label: "Closed Won", tone: "success" },
          CLOSED_LOST: { id: "lost", label: "Lost / Recycled", tone: "warning" },
        };

        const effectiveStatus = matchedLead?.stage ? stageToConvStatus[matchedLead.stage] : null;

        return {
          ...conv,
          customerDisplayName: realName,
          customerAccountType: accountType,
          customerPackageName: matchedUser?.packageName || null,
          customerPackageStatus: matchedUser?.packageStatus || null,
          customerPlanDaysRemaining: planDaysRemaining,
          customerAppInstalled: matchedUser ? installedUserIds.has(matchedUser.id) : false,
          leadPriority: matchedLead?.priority || null,
          leadStage: matchedLead?.stage || null,
          leadStatusId: effectiveStatus ? effectiveStatus.id : (conv.leadStatusId || "inbound"),
          leadStatusLabel: effectiveStatus ? effectiveStatus.label : (conv.leadStatusLabel || (matchedLead ? "New Lead" : "Inbound Chat")),
          leadStatusTone: effectiveStatus ? effectiveStatus.tone : conv.leadStatusTone,
        };
      });

      if (scope.audience === "sales") {
        enrichedConversations = enrichedConversations.filter((conv) => {
          if (conv.tenantId && conv.tenantId.startsWith("tenant-agency-")) {
            return false;
          }
          return true;
        });
      }
    } catch (err) {
      console.warn("[api/conversations] Failed to enrich conversations:", err);
    }
  }

  return NextResponse.json({
    ok: true,
    ...payload,
    conversations: enrichedConversations,
    assignableEditors: includeSupportData ? assignableEditors : [],
    leadStatuses:
      payload.leadStatuses && payload.leadStatuses.length > 0
        ? payload.leadStatuses
        : crmStatuses.map((status) => ({
            id: status.id,
            label: status.label,
            tone: status.tone,
            order: status.order,
            active: status.active,
          })),
    templates: includeSupportData ? payload.templates : [],
    supportDataIncluded: includeSupportData,
  });
}

export async function POST(request: Request) {
  const authorization = await requireSessionRole(["SUPER_ADMIN", "ADMIN", "MANAGER"]);
  if (!authorization.ok) {
    return authorization.response;
  }

  await request.json().catch(() => null);

  return NextResponse.json(
    {
      ok: false,
      error: "Direct in-app customer conversation creation has been retired. Use WhatsApp webhook intake or the internal manual conversation API.",
    },
    { status: 410 },
  );
}

export async function DELETE(request: Request) {
  const authorization = await requireSessionRole(["SUPER_ADMIN", "ADMIN", "MANAGER", "SALES_AGENT"]);
  if (!authorization.ok) {
    return authorization.response;
  }

  const { searchParams } = new URL(request.url);
  const conversationId = searchParams.get("conversationId")?.trim() || searchParams.get("id")?.trim();
  if (!conversationId) {
    return NextResponse.json({ ok: false, error: "Missing conversationId" }, { status: 400 });
  }

  try {
    await prisma.$transaction([
      prisma.salesLeadAssignment.deleteMany({
        where: {
          OR: [{ conversationId }, { id: `sales-conversation-${conversationId}` }],
        },
      }),
      prisma.appChatMessageReceipt.deleteMany({
        where: { conversationId },
      }),
      prisma.appChatTypingPresence.deleteMany({
        where: { conversationId },
      }),
      prisma.appConversation.deleteMany({
        where: { id: conversationId },
      }),
    ]);
  } catch (error) {
    console.error("[api/conversations] DELETE error in database:", error);
  }

  try {
    await deleteConversationFromFile(conversationId);
  } catch (error) {
    console.warn("[api/conversations] Failed to delete from file snapshot:", error);
  }

  return NextResponse.json({ ok: true, deletedConversationId: conversationId });
}
