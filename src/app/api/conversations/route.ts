import { NextResponse } from "next/server";

import { resolveConversationAudienceForSession } from "@/lib/api/conversation-access";
import { requireSessionRole } from "@/lib/api/require-session-role";
import { resolveWhatsAppSetupTenantId } from "@/lib/api/resolve-session-tenant";
import type { ManagedAuthUser } from "@/lib/auth/types";
import type { WorkloadBand } from "@/lib/gigxomi/business-ecosystem-data";
import {
  deleteConversationFromFile,
  listConversationsForAudienceFromFile,
} from "@/lib/gigxomi/dummy-platform-file-store";
import { findConfirmedAgencyEditorForManagedUser } from "@/lib/gigxomi/agency-editor-eligibility";
import { crmStatuses } from "@/lib/gigxomi/crm-data";
import { getManagedAuthUsers } from "@/lib/auth/store";
import { prisma } from "@/lib/prisma";

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
        ? resolveWhatsAppSetupTenantId(authorization.session, explicitTenantId)
        : (authorization.session.tenantId?.trim() || explicitTenantId);
  if ((scope.audience === "admin" || scope.audience === "manager") && authorization.session.role !== "SUPER_ADMIN" && !tenantId) {
    return NextResponse.json({ ok: false, error: "This account is not attached to an agency workspace yet." }, { status: 403 });
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

  let assignableEditors = payload.assignableEditors;
  if (includeSupportData && (scope.audience === "admin" || scope.audience === "manager")) {
    const [managedUsers, legacyMemberships, appMemberships, freelancerProfiles, freelancerServices] = await Promise.all([
      getManagedAuthUsers(),
      tenantId
        ? prisma.teamMembership.findMany({
            where: { tenantId, status: "ACTIVE", assignmentEligible: true },
            include: { editorProfile: { include: { user: true } } },
          })
        : Promise.resolve([]),
      tenantId
        ? prisma.appTeamMembership.findMany({ where: { tenantId, status: "ACTIVE" } })
        : Promise.resolve([]),
      prisma.appAuthUser.findMany({
        where: { OR: [{ role: "FREELANCER" }, { assignedRole: "FREELANCER" }] },
        select: { id: true, lastLoginAt: true, freelancerWorkspace: { select: { profile: true, verification: true } } },
      }),
      prisma.appFreelancerService.findMany({
        where: { status: { in: ["APPROVED", "PUBLISHED"] } },
        orderBy: { updatedAt: "desc" },
      }),
    ]);
    const confirmedEditors = [
      ...legacyMemberships.map((membership) => ({
        editorProfileId: membership.editorProfileId,
        displayName: membership.editorProfile.user.displayName,
        email: membership.editorProfile.user.email,
        phone: membership.editorProfile.user.phone,
        title: membership.editorProfile.title,
        category: membership.editorProfile.category,
        karmaScore: membership.editorProfile.karmaScore,
      })),
      ...appMemberships.map((membership) => ({
        editorProfileId: membership.freelancerId,
        displayName: membership.freelancerName,
        title: membership.roleType || "Freelance editor",
        category: membership.roleType || "Creative services",
        karmaScore: 0,
      })),
    ];

    const profilesByUserId = new Map(freelancerProfiles.map((profile) => [profile.id, profile]));
    const servicesByUserId = new Map<string, typeof freelancerServices>();
    for (const service of freelancerServices) {
      const current = servicesByUserId.get(service.ownerId) ?? [];
      current.push(service);
      servicesByUserId.set(service.ownerId, current);
    }

    assignableEditors = managedUsers
      .map((user: ManagedAuthUser) => ({ user, editor: findConfirmedAgencyEditorForManagedUser(user, confirmedEditors) }))
      .filter(
        ({ user, editor }) =>
          Boolean(editor) || (user.packageStatus !== "PAUSED" && user.packageStatus !== "EXPIRED"),
      )
      .filter((entry, index, entries) => entries.findIndex((candidate) => candidate.user.id === entry.user.id) === index)
      .map(({ user, editor }) => {
        const profileRecord = profilesByUserId.get(user.id);
        const profile = record(profileRecord?.freelancerWorkspace?.profile);
        const verification = record(profileRecord?.freelancerWorkspace?.verification);
        const services = (servicesByUserId.get(user.id) ?? []).slice(0, 4).map((service) => {
          const payload = record(service.payload);
          return {
            id: service.id,
            slug: service.slug,
            title: text(payload.title) || "Editing service",
            category: text(payload.category) || text(payload.specialty) || null,
            price: number(payload.basePrice),
            deliveryTime: text(payload.deliveryTime) || null,
          };
        });
        const servicePrices = services.map((service) => service.price).filter((price): price is number => price !== null && price > 0);
        const portfolioLinks = Array.from(new Set([
          ...list(profile.socialLinks),
          ...services.map((service) => `/services/${service.slug}`),
        ]));
        const isOnline = Boolean(profileRecord?.lastLoginAt && profileRecord.lastLoginAt.getTime() >= Date.now() - 15 * 60 * 1000);
        return {
          id: user.id,
          name: text(profile.displayName) || user.displayName,
          specialties: Array.from(new Set([
            ...list(profile.skills),
            editor?.category,
            editor?.title,
            ...services.map((service) => service.category),
            "Creative services",
          ].map((value) => String(value ?? "").trim()).filter(Boolean))),
          workloadBand: workloadBand(profile.workloadBand || profile.availability),
          karmaScore: number(profile.karmaScore) ?? editor?.karmaScore ?? 0,
          onlineStatus: isOnline ? ("online" as const) : ("offline" as const),
          lastOnlineAt: profileRecord?.lastLoginAt?.toISOString(),
          acceptingProjects: true,
          isTeamMember: Boolean(editor),
          offerEligible: Boolean(editor) || (user.packageStatus !== "PAUSED" && user.packageStatus !== "EXPIRED"),
          directAssignmentEligible: Boolean(editor),
          verificationStatus: text(verification.status) || "DRAFT",
          startingPrice: number(profile.startingPrice) ?? (servicePrices.length ? Math.min(...servicePrices) : null),
          portfolioLinks,
          services,
        };
      });
  }

  // Enrich conversations with Customer 360 / Registration details for sales closer
  let enrichedConversations = payload?.conversations ?? [];
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

        // Better display name: If current name is unknown or default, use matched user or lead name
        const rawName = (conv.customerDisplayName || "").trim();
        const isDefaultOrUnknown =
          !rawName ||
          rawName.toLowerCase() === "unknown customer" ||
          rawName.toLowerCase() === "whatsapp customer" ||
          rawName.toLowerCase() === "customer";
        const realName =
          (isDefaultOrUnknown ? matchedUser?.displayName || matchedLead?.customerName : null) ||
          rawName ||
          conv.customerPhoneDisplay ||
          "Lead";

        let accountType: "AGENCY" | "FREELANCER" | "LEAD" = "LEAD";
        if (matchedUser?.packageAudience === "AGENCY" || matchedUser?.role === "ADMIN") {
          accountType = "AGENCY";
        } else if (matchedUser?.packageAudience === "FREELANCER" || matchedUser?.role === "FREELANCER") {
          accountType = "FREELANCER";
        } else if (conv.agencyContext?.agencyName) {
          accountType = "AGENCY";
        }

        const expiresAt = matchedUser?.packageExpiresAt ? new Date(matchedUser.packageExpiresAt) : null;
        const planDaysRemaining = expiresAt
          ? Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
          : null;

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
        };
      });

      if (scope.audience === "sales") {
        enrichedConversations = enrichedConversations.filter((conv) => {
          // Never show agency workspace conversations or freelancer internal threads in closer desk
          if (conv.tenantId && conv.tenantId.startsWith("tenant-agency-")) {
            return false;
          }
          if (conv.customerAccountType === "FREELANCER" && !conv.leadStage) {
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
