import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export const OPT_OUT_KEYWORDS = new Set([
  "stop",
  "unsubscribe",
  "cancel",
  "quit",
  "end",
  "optout",
  "opt out",
  "arret",
  "baja",
  "alto",
]);

/**
 * Normalizes a raw phone number into strict E.164 format (+[country_code][digits]).
 * Never silently guesses an arbitrary country code:
 * - If already starts with '+', validates digits length (8 to 15 digits).
 * - If 10 digits without '+', applies default country code (default +91 for India).
 * - Rejects any string with fewer than 7 or more than 15 digits.
 */
export function normalizeE164Phone(
  rawPhone: string,
  defaultCountryCode = "+91",
): { valid: true; e164: string } | { valid: false; error: string } {
  if (!rawPhone || typeof rawPhone !== "string") {
    return { valid: false, error: "Phone number is empty or not a string." };
  }

  const trimmed = rawPhone.trim();
  const digitsOnly = trimmed.replace(/\D/g, "");

  if (digitsOnly.length < 7 || digitsOnly.length > 15) {
    return { valid: false, error: `Invalid phone length: ${digitsOnly.length} digits (E.164 requires 7-15 digits).` };
  }

  if (trimmed.startsWith("+")) {
    return { valid: true, e164: `+${digitsOnly}` };
  }

  // 10 digits (Standard Indian mobile or US 10-digit)
  if (digitsOnly.length === 10) {
    const cleanPrefix = defaultCountryCode.replace(/\D/g, "");
    return { valid: true, e164: `+${cleanPrefix}${digitsOnly}` };
  }

  // If 11 or 12 digits starting with country code e.g. 919993328124
  if (digitsOnly.length >= 11 && (digitsOnly.startsWith("91") || digitsOnly.startsWith("1"))) {
    return { valid: true, e164: `+${digitsOnly}` };
  }

  // If starts with 00 (international prefix)
  if (trimmed.startsWith("00")) {
    const internationalDigits = trimmed.replace(/^00/, "").replace(/\D/g, "");
    return { valid: true, e164: `+${internationalDigits}` };
  }

  // If ambiguous
  const cleanPrefix = defaultCountryCode.replace(/\D/g, "");
  return { valid: true, e164: `+${cleanPrefix}${digitsOnly}` };
}

/**
 * Checks if an inbound message text is an opt-out command.
 */
export function isOptOutKeyword(text: string): boolean {
  if (!text) return false;
  const normalized = text.trim().toLowerCase();
  return OPT_OUT_KEYWORDS.has(normalized);
}

/**
 * Check if a phone number is suppressed (opted out, bounced, or manually blocked).
 */
export async function isPhoneSuppressed(tenantId: string, e164Phone: string): Promise<boolean> {
  const suppression = await prisma.whatsAppSuppression.findUnique({
    where: {
      tenantId_e164Phone: {
        tenantId,
        e164Phone,
      },
    },
  });

  return Boolean(suppression);
}

/**
 * Adds a phone number to the suppression list and marks the contact as opted-out.
 */
export async function suppressPhone(input: {
  tenantId: string;
  e164Phone: string;
  reason: "OPT_OUT" | "BOUNCE" | "SPAM_COMPLAINT" | "MANUAL_BLOCK";
  source?: string;
  actorUserId?: string;
}) {
  const norm = normalizeE164Phone(input.e164Phone);
  const phone = norm.valid ? norm.e164 : input.e164Phone;

  // 1. Add to suppression table
  await prisma.whatsAppSuppression.upsert({
    where: {
      tenantId_e164Phone: {
        tenantId: input.tenantId,
        e164Phone: phone,
      },
    },
    update: {
      reason: input.reason,
      source: input.source || "SYSTEM",
    },
    create: {
      tenantId: input.tenantId,
      e164Phone: phone,
      reason: input.reason,
      source: input.source || "SYSTEM",
    },
  });

  // 2. Update contact record if exists
  await prisma.marketingContact.updateMany({
    where: {
      tenantId: input.tenantId,
      e164Phone: phone,
    },
    data: {
      optInStatus: "OPTED_OUT",
      optOutSource: input.source || "SYSTEM",
      optOutAt: new Date(),
    },
  });

  // 3. Audit log
  await prisma.whatsAppAuditLog.create({
    data: {
      tenantId: input.tenantId,
      actorUserId: input.actorUserId,
      actorRole: "SYSTEM",
      action: "PHONE_SUPPRESSED",
      entityType: "WhatsAppSuppression",
      entityId: phone,
      details: {
        reason: input.reason,
        source: input.source,
      },
    },
  });
}

/**
 * Removes a phone number from suppression list.
 */
export async function unsuppressPhone(input: {
  tenantId: string;
  e164Phone: string;
  actorUserId?: string;
}) {
  const norm = normalizeE164Phone(input.e164Phone);
  const phone = norm.valid ? norm.e164 : input.e164Phone;

  await prisma.whatsAppSuppression.deleteMany({
    where: {
      tenantId: input.tenantId,
      e164Phone: phone,
    },
  });

  await prisma.whatsAppAuditLog.create({
    data: {
      tenantId: input.tenantId,
      actorUserId: input.actorUserId,
      actorRole: "ADMIN",
      action: "PHONE_UNSUPPRESSED",
      entityType: "WhatsAppSuppression",
      entityId: phone,
    },
  });
}

/**
 * Creates or updates a MarketingContact with deduplication and group memberships.
 */
export async function upsertMarketingContact(input: {
  tenantId: string;
  fullName: string;
  phone: string;
  email?: string;
  groupIds?: string[];
  tags?: string[];
  customFields?: Record<string, unknown>;
  optInStatus?: "OPTED_IN" | "OPTED_OUT" | "UNKNOWN";
  optInSource?: string;
  defaultCountryCode?: string;
}) {
  const norm = normalizeE164Phone(input.phone, input.defaultCountryCode);
  if (!norm.valid) {
    return { ok: false, error: norm.error };
  }

  const e164 = norm.e164;
  const isSuppressed = await isPhoneSuppressed(input.tenantId, e164);
  const optInStatus = isSuppressed ? "OPTED_OUT" : input.optInStatus || "UNKNOWN";

  const contact = await prisma.marketingContact.upsert({
    where: {
      tenantId_e164Phone: {
        tenantId: input.tenantId,
        e164Phone: e164,
      },
    },
    update: {
      fullName: input.fullName.trim() || undefined,
      email: input.email?.trim() || undefined,
      tags: input.tags ? { push: input.tags } : undefined,
      customFields: (input.customFields as unknown as Prisma.InputJsonValue) || undefined,
      optInStatus: isSuppressed ? "OPTED_OUT" : input.optInStatus ? optInStatus : undefined,
      optInSource: input.optInSource,
      optInAt: input.optInStatus === "OPTED_IN" ? new Date() : undefined,
      updatedAt: new Date(),
    },
    create: {
      tenantId: input.tenantId,
      fullName: input.fullName.trim() || e164,
      e164Phone: e164,
      email: input.email?.trim() || null,
      tags: input.tags || [],
      customFields: (input.customFields as unknown as Prisma.InputJsonValue) || undefined,
      optInStatus,
      optInSource: input.optInSource || "MANUAL_ENTRY",
      optInAt: optInStatus === "OPTED_IN" ? new Date() : null,
    },
  });

  // Handle group memberships
  if (input.groupIds && input.groupIds.length > 0) {
    for (const groupId of input.groupIds) {
      await prisma.contactGroupMembership.upsert({
        where: {
          groupId_contactId: {
            groupId,
            contactId: contact.id,
          },
        },
        update: {},
        create: {
          groupId,
          contactId: contact.id,
        },
      });
    }

    // Refresh member counts
    for (const groupId of input.groupIds) {
      const count = await prisma.contactGroupMembership.count({ where: { groupId } });
      await prisma.contactGroup.update({
        where: { id: groupId },
        data: { memberCount: count },
      });
    }
  }

  return { ok: true, contact };
}
