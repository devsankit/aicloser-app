import "server-only";

import type { Prisma } from "@prisma/client";

import type { JourneyEventContract } from "@/lib/gxclosers/journey-contract";
import { prisma } from "@/lib/prisma";

function json(value: Record<string, unknown> | null | undefined) {
  return value ? (value as Prisma.InputJsonValue) : undefined;
}

function lifecycleFor(eventType: string) {
  const stages: Record<string, string> = {
    "account.verified": "OTP_VERIFIED",
    "agency.first_delivery": "FIRST_DELIVERY",
    "agency.first_project": "FIRST_PROJECT",
    "agency.four_projects": "SCALED",
    "agency.two_projects": "AGENCY_ACTIVATED",
    "onboarding.completed": "ONBOARDING_COMPLETE",
    "role.selected": "ROLE_SELECTED",
    "store.cta_clicked": "PLAY_STORE_VISITED",
    "subscription.freemium_activated": "FREEMIUM_ACTIVATED",
    "subscription.premium_activated": "PREMIUM",
    "subscription.upgrade_intent": "UPGRADE_INTENT",
    "webinar.cta_clicked": "WEBINAR_CTA_CLICKED",
    "webinar.engaged": "WEBINAR_ENGAGED",
    "webinar.joined": "WEBINAR_JOINED",
    "webinar.registered": "WEBINAR_REGISTERED",
    "webinar.session_assigned": "WEBINAR_SESSION_ASSIGNED",
  };
  return stages[eventType] ?? (eventType.startsWith("learning.video.") ? "LEARNING_ENGAGED" : "UNKNOWN");
}

const lifecycleOrder = [
  "UNKNOWN", "WEBINAR_REGISTERED", "WEBINAR_SESSION_ASSIGNED", "WEBINAR_JOINED", "WEBINAR_ENGAGED", "WEBINAR_CTA_CLICKED",
  "PLAY_STORE_VISITED", "OTP_VERIFIED", "ROLE_SELECTED", "LEARNING_ENGAGED", "ONBOARDING_COMPLETE", "FREEMIUM_ACTIVATED",
  "FIRST_PROJECT", "FIRST_DELIVERY", "AGENCY_ACTIVATED", "UPGRADE_INTENT", "PREMIUM", "SCALED",
];

function laterLifecycle(existing: string | undefined, requested: string) {
  const existingRank = lifecycleOrder.indexOf(existing || "UNKNOWN");
  const requestedRank = lifecycleOrder.indexOf(requested);
  return existingRank > requestedRank ? existing! : requested;
}

const commercialOrder = ["UNKNOWN", "PROSPECT", "FREEMIUM", "UPGRADE_INTENT", "PREMIUM"];

function laterCommercial(existing: string | undefined, requested: string) {
  return commercialOrder.indexOf(existing || "UNKNOWN") > commercialOrder.indexOf(requested) ? existing! : requested;
}

function commercialFor(eventType: string) {
  if (eventType === "subscription.premium_activated") return "PREMIUM";
  if (eventType === "subscription.freemium_activated") return "FREEMIUM";
  if (eventType === "subscription.upgrade_intent") return "UPGRADE_INTENT";
  return "PROSPECT";
}

function normalizePhone(value: string | null | undefined) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : "";
}

function readAttribution(metadata: Record<string, unknown> | null) {
  const value = metadata?.attribution;
  if (!value || typeof value !== "object" || Array.isArray(value)) return { firstTouch: undefined, lastTouch: undefined };
  const bundle = value as Record<string, unknown>;
  return {
    firstTouch: bundle.firstTouch && typeof bundle.firstTouch === "object" ? (bundle.firstTouch as Record<string, unknown>) : undefined,
    lastTouch: bundle.lastTouch && typeof bundle.lastTouch === "object" ? (bundle.lastTouch as Record<string, unknown>) : undefined,
  };
}

async function resolveRegistrationContext(tx: Prisma.TransactionClient, event: JourneyEventContract) {
  if (!event.webinarRegistrationId) {
    return { appUserId: event.appUserId, identityStatus: event.appUserId ? "VERIFIED_SOURCE" : "UNRESOLVED", registration: null, salesLeadId: event.salesLeadId, salesPoolItemId: null };
  }
  const registration = await tx.gappWebinarRegistration.findUnique({ where: { id: event.webinarRegistrationId } });
  if (!registration) return { appUserId: event.appUserId, identityStatus: "REGISTRATION_MISSING", registration: null, salesLeadId: event.salesLeadId, salesPoolItemId: null };

  const phone = normalizePhone(registration.whatsappNumber);
  const email = registration.email.trim().toLowerCase();
  const users = await tx.appAuthUser.findMany({
    where: { OR: [{ email }, { phone: { endsWith: phone } }] },
    select: { id: true },
    take: 3,
  });
  const uniqueUserIds = [...new Set(users.map((user) => user.id))];
  const appUserId = event.appUserId || (uniqueUserIds.length === 1 ? uniqueUserIds[0] : null);
  const identityStatus = uniqueUserIds.length > 1 ? "CONFLICT" : appUserId ? "VERIFIED_CONTACT" : "UNRESOLVED";

  const assignments = await tx.salesLeadAssignment.findMany({
    where: { OR: [{ customerEmail: { equals: email, mode: "insensitive" } }, { customerPhone: { endsWith: phone } }] },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
    take: 3,
  });
  const salesLeadId = event.salesLeadId || (assignments.length === 1 ? assignments[0].id : null);

  let salesPoolItem = await tx.salesLeadPoolItem.findFirst({
    where: {
      OR: [{ customerEmail: { equals: email, mode: "insensitive" } }, { customerPhone: { endsWith: phone } }],
      status: { in: ["OPEN", "CLAIMED"] },
    },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });
  if (!salesLeadId && !salesPoolItem) {
    salesPoolItem = await tx.salesLeadPoolItem.create({
      data: {
        customerEmail: email,
        customerName: registration.fullName,
        customerPhone: registration.whatsappNumber,
        notes: `Free webinar registration · ${registration.currentMonthlyProjects} monthly projects`,
        priority: /10\+/.test(registration.currentMonthlyProjects) ? "high" : "normal",
        segment: registration.participantType,
        serviceInterest: "Agency subscription",
        source: "ankit_webinar",
      },
      select: { id: true },
    });
  }

  return { appUserId, identityStatus, registration, salesLeadId, salesPoolItemId: salesPoolItem?.id ?? null };
}

export async function ingestJourneyEvent(event: JourneyEventContract) {
  const duplicate = await prisma.gxJourneyEvent.findFirst({ where: { OR: [{ externalEventId: event.eventId }, { eventKey: event.eventKey }] } });
  if (duplicate) return { duplicate: true, eventId: duplicate.id };

  try {
    return await prisma.$transaction(async (tx) => {
      const context = await resolveRegistrationContext(tx, event);
      const attribution = readAttribution(event.metadata);
      const existingSnapshot = await tx.gxJourneySnapshot.findUnique({
        where: { subjectType_subjectId: { subjectId: event.subjectId, subjectType: event.subjectType } },
      });
      const lifecycleStage = laterLifecycle(existingSnapshot?.lifecycleStage, lifecycleFor(event.eventType));
      const commercialState = laterCommercial(existingSnapshot?.commercialState, commercialFor(event.eventType));
      const created = await tx.gxJourneyEvent.create({
        data: {
          appUserId: context.appUserId,
          consentContext: json(event.consentContext),
          eventKey: event.eventKey,
          eventType: event.eventType,
          eventVersion: event.eventVersion,
          externalEventId: event.eventId,
          metadata: json(event.metadata),
          occurredAt: event.occurredAt,
          salesLeadId: context.salesLeadId,
          salesPoolItemId: context.salesPoolItemId,
          source: event.source,
          sourceReceivedAt: event.receivedAt,
          subjectId: event.subjectId,
          subjectType: event.subjectType,
          webinarRegistrationId: event.webinarRegistrationId,
        },
      });
      await tx.gxJourneySnapshot.upsert({
        where: { subjectType_subjectId: { subjectId: event.subjectId, subjectType: event.subjectType } },
        create: {
          appUserId: context.appUserId,
          commercialState,
          engagementState: "ENGAGED",
          firstTouch: json(attribution.firstTouch),
          identityStatus: context.identityStatus,
          lastEventAt: event.occurredAt,
          lastEventType: event.eventType,
          lastTouch: json(attribution.lastTouch),
          lifecycleStage,
          salesLeadId: context.salesLeadId,
          salesPoolItemId: context.salesPoolItemId,
          subjectId: event.subjectId,
          subjectType: event.subjectType,
        },
        update: {
          appUserId: context.appUserId,
          commercialState,
          engagementState: "ENGAGED",
          identityStatus: context.identityStatus,
          lastEventAt: event.occurredAt,
          lastEventType: event.eventType,
          lastTouch: json(attribution.lastTouch),
          lifecycleStage,
          salesLeadId: context.salesLeadId,
          salesPoolItemId: context.salesPoolItemId,
        },
      });
      if (context.salesLeadId) {
        await tx.salesLeadTimelineEntry.create({
          data: {
            body: `Customer journey event: ${event.eventType}`,
            leadId: context.salesLeadId,
            metadata: { eventId: created.id, source: event.source },
            type: "CUSTOMER_JOURNEY",
          },
        });
        if (context.appUserId && context.identityStatus !== "CONFLICT") {
          const activeLink = await tx.gxLeadIdentityLink.findFirst({ where: { isActive: true, salesLeadId: context.salesLeadId } });
          if (!activeLink) {
            await tx.gxLeadIdentityLink.create({
              data: { appUserId: context.appUserId, method: "VERIFIED_PHONE_OR_EMAIL", salesLeadId: context.salesLeadId },
            });
          }
        }
      }
      return { duplicate: false, eventId: created.id, salesLeadId: context.salesLeadId, salesPoolItemId: context.salesPoolItemId };
    });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      const existing = await prisma.gxJourneyEvent.findFirst({ where: { OR: [{ externalEventId: event.eventId }, { eventKey: event.eventKey }] } });
      if (existing) return { duplicate: true, eventId: existing.id };
    }
    throw error;
  }
}
