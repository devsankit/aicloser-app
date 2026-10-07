import "server-only";

import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import {
  getConversationByIdFromFile,
} from "@/lib/gigxomi/dummy-platform-file-store";
import { publishConversationRealtimeEvent } from "@/lib/gigxomi/conversation-realtime";
import {
  enqueueMetaConversion,
  deliverMetaConversions,
  getMetaConversionConfig,
} from "@/lib/meta/conversions-api";
import type { ConversionEventName } from "@/lib/meta/conversion-contract";

const QUALIFIED_STATUS_SET = new Set([
  "new",
  "new-leads",
  "contacted",
  "qualified",
  "interested",
  "agency-connected",
  "app-installed",
  "in-progress",
  "work-done",
  "delivered",
  "closed",
  "closed-won",
  "paid",
  "training-booked",
  "webinar-invited",
]);

function normalizePhoneDigits(phone: string): string {
  const digits = String(phone || "").replace(/[^\d]/g, "");
  if (!digits) return "";
  if (digits.length === 10) return "91" + digits;
  if (digits.startsWith("00")) return digits.slice(2);
  return digits;
}

export type LeadStatusSyncResult = {
  ok: boolean;
  statusId: string;
  isQualified: boolean;
  meta: {
    enqueued: boolean;
    sent: boolean;
    eventName?: ConversionEventName;
    eventId?: string;
    traceId?: string;
    error?: string;
  };
};

export async function syncLeadStatusToMetaAndOutbox(input: {
  conversationId: string;
  leadStatusId: string;
  notes?: string;
  actorUserId?: string;
}): Promise<LeadStatusSyncResult> {
  const { conversationId, leadStatusId } = input;
  const statusKey = String(leadStatusId || "").trim().toLowerCase();
  const isQualified = QUALIFIED_STATUS_SET.has(statusKey) || statusKey.includes("qualif");

  // 1. Fetch conversation details. DB-backed inboxes should use the narrow
  // canonical row here; loading the complete snapshot adds avoidable latency
  // to every stage change and CAPI conversion.
  let conversation: { customerPhone?: string; customerName?: string; tenantId?: string } | null = null;
  let customerPhone = "";
  let tenantId = "";
  if (process.env.DATABASE_URL?.trim()) {
    try {
      const dbConv = await prisma.appConversation.findUnique({
        where: { id: conversationId },
        select: { customerPhone: true, customerName: true, tenantId: true },
      });
      if (dbConv) {
        conversation = dbConv;
        customerPhone = dbConv.customerPhone || "";
        tenantId = dbConv.tenantId;
      }
    } catch {
      // Fall through to the file snapshot when the database is unavailable.
    }
  }
  if (!conversation) {
    conversation = await getConversationByIdFromFile(conversationId);
    customerPhone = conversation?.customerPhone ?? "";
    tenantId = conversation?.tenantId ?? "";
  }

  // 2. Publish realtime event to Closer app SSE
  try {
    if (conversation) {
      await publishConversationRealtimeEvent({
        conversationId,
        eventType: "conversation-updated",
        tenantId: conversation.tenantId,
      });
    }
  } catch (err) {
    console.error("[lead-status-meta-sync] Realtime SSE dispatch error:", err);
  }

  // 3. If not a qualifying conversion status, return early
  if (!isQualified) {
    return {
      ok: true,
      statusId: leadStatusId,
      isQualified: false,
      meta: { enqueued: false, sent: false },
    };
  }

  // 4. Determine conversion event name
  const eventName: ConversionEventName =
    statusKey === "closed" || statusKey === "closed-won" || statusKey === "paid"
      ? "Purchase"
      : statusKey === "training-booked" || statusKey === "webinar-invited"
        ? "Schedule"
        : statusKey === "agency-connected" || statusKey === "app-installed"
          ? "CompleteRegistration"
          : "Lead";

  const normalizedPhone = normalizePhoneDigits(customerPhone);
  const nowSec = Math.floor(Date.now() / 1000);
  const hashKey = `${conversationId}:${statusKey}:${normalizedPhone || "nophone"}`;
  const eventId = `lead_${createHash("sha256").update(hashKey).digest("hex").slice(0, 24)}`;

  const metaResult: LeadStatusSyncResult["meta"] = {
    enqueued: false,
    sent: false,
    eventName,
    eventId,
  };

  try {
    const config = getMetaConversionConfig("WEB");
    if (config.enabled && config.accessToken && config.datasetId) {
      // Check for Click-to-WhatsApp ad click ID in conversation or pool
      let ctwaClid: string | undefined;
      let wabaId: string | undefined;

      if (process.env.DATABASE_URL?.trim()) {
        try {
          const adEvent = await prisma.metaConversionEvent.findFirst({
            where: {
              conversationId,
              source: "WHATSAPP",
              status: "ATTRIBUTED",
            },
            orderBy: { createdAt: "desc" },
          });
          if (adEvent && typeof adEvent.metadata === "object" && adEvent.metadata !== null) {
            const md = adEvent.metadata as Record<string, unknown>;
            const ud = (md.user_data ?? {}) as Record<string, unknown>;
            if (typeof ud.ctwa_clid === "string" && ud.ctwa_clid.trim()) {
              ctwaClid = ud.ctwa_clid.trim();
              wabaId = String(ud.whatsapp_business_account_id ?? "").trim() || process.env.META_CAPI_WHATSAPP_PHONE_NUMBER_ID;
            }
          }
        } catch {
          // ignore ad attribution lookup
        }
      }

      // If Click-to-WhatsApp ad attribution exists, enqueue LeadSubmitted for WhatsApp dataset
      if (ctwaClid && wabaId) {
        const waEventId = `wa_qual_${createHash("sha256").update(`${eventId}:wa`).digest("hex").slice(0, 24)}`;
        await enqueueMetaConversion({
          eventName: "LeadSubmitted",
          source: "WHATSAPP",
          eventId: waEventId,
          eventTime: nowSec,
          tenantId: tenantId || undefined,
          conversationId,
          userData: {
            ctwaClid,
            wabaId,
          },
        }).catch((err) => console.error("[lead-status-meta-sync] WhatsApp CAPI enqueue error:", err));
      }

      // Enqueue primary Web / CAPI lead conversion with customer phone
      const enqueueRes = await enqueueMetaConversion({
        eventName,
        source: "WEB",
        eventId,
        eventTime: nowSec,
        eventSourceUrl: "https://gigxomi.com/",
        tenantId: tenantId || undefined,
        conversationId,
        userData: {
          phone: normalizedPhone || undefined,
          clientUserAgent: "Gigxomi-Closer-CAPI/1.0",
        },
        customData: eventName === "Purchase" ? { currency: "INR", value: 2000 } : undefined,
      });

      if (enqueueRes.queued) {
        metaResult.enqueued = true;
        // Deliver immediately
        const delivery = await deliverMetaConversions(eventId);
        if (delivery.sent > 0) {
          metaResult.sent = true;
          // Retrieve traceId from the record
          try {
            const deliveredRow = await prisma.metaConversionEvent.findUnique({
              where: { eventId },
              select: { traceId: true },
            });
            metaResult.traceId = deliveredRow?.traceId || undefined;
          } catch {
            // ignore
          }
        }
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[lead-status-meta-sync] Meta conversion dispatch failed:", msg);
    metaResult.error = msg;
  }

  return {
    ok: true,
    statusId: leadStatusId,
    isQualified,
    meta: metaResult,
  };
}
