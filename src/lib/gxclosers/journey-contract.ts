export const journeyEventTypes = new Set([
  "account.verified",
  "agency.first_delivery",
  "agency.first_project",
  "agency.four_projects",
  "agency.two_projects",
  "learning.video.25_percent",
  "learning.video.50_percent",
  "learning.video.75_percent",
  "learning.video.90_percent",
  "learning.video.completed",
  "learning.video.dropped",
  "learning.video.resumed",
  "learning.video.started",
  "onboarding.completed",
  "role.selected",
  "store.cta_clicked",
  "subscription.freemium_activated",
  "subscription.premium_activated",
  "subscription.upgrade_intent",
  "webinar.cta_clicked",
  "webinar.engaged",
  "webinar.joined",
  "webinar.registered",
  "webinar.session_assigned",
]);

export type JourneyEventContract = {
  appUserId: string | null;
  consentContext: Record<string, unknown> | null;
  eventId: string;
  eventKey: string;
  eventType: string;
  eventVersion: number;
  metadata: Record<string, unknown> | null;
  occurredAt: Date;
  receivedAt: Date | null;
  salesLeadId: string | null;
  source: string;
  subjectId: string;
  subjectType: string;
  webinarRegistrationId: string | null;
};

function text(value: unknown, maxLength = 240) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function nullableText(value: unknown, maxLength = 240) {
  return text(value, maxLength) || null;
}

function object(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function date(value: unknown, required: boolean) {
  const parsed = typeof value === "string" ? new Date(value) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) return required ? undefined : null;
  return parsed;
}

export function validateJourneyEnvelope(value: unknown) {
  const envelope = object(value);
  const raw = object(envelope?.event);
  if (!raw) return { ok: false as const, error: "An event envelope is required." };

  const eventId = text(raw.eventId, 160);
  const eventKey = text(raw.eventKey, 240);
  const eventType = text(raw.eventType, 120);
  const eventVersion = Number(raw.eventVersion);
  const occurredAt = date(raw.occurredAt, true);
  const source = text(raw.source, 120);
  const subjectId = text(raw.subjectId, 200);
  const subjectType = text(raw.subjectType, 80);

  if (!eventId || !eventKey || !eventType || !source || !subjectId || !subjectType || !occurredAt) {
    return { ok: false as const, error: "The journey event is missing required fields." };
  }
  if (!journeyEventTypes.has(eventType)) return { ok: false as const, error: "The journey event type is not supported." };
  if (eventVersion !== 1) return { ok: false as const, error: "The journey event version is not supported." };
  if (occurredAt.getTime() > Date.now() + 5 * 60 * 1000) return { ok: false as const, error: "The journey event timestamp is in the future." };

  const event: JourneyEventContract = {
    appUserId: nullableText(raw.appUserId, 160),
    consentContext: object(raw.consentContext),
    eventId,
    eventKey,
    eventType,
    eventVersion,
    metadata: object(raw.metadata),
    occurredAt,
    receivedAt: date(raw.receivedAt, false) ?? null,
    salesLeadId: nullableText(raw.salesLeadId, 160),
    source,
    subjectId,
    subjectType,
    webinarRegistrationId: nullableText(raw.webinarRegistrationId, 160),
  };
  return { ok: true as const, event };
}
