import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { Prisma, WhatsAppTemplateStatus, WhatsAppMessageStatus, WhatsAppRecipientStatus } from "@prisma/client";
import { isOptOutKeyword, suppressPhone } from "./contact-service";

export type MetaWebhookStatusObject = {
  id: string;
  status: "sent" | "delivered" | "read" | "failed";
  timestamp: string;
  recipient_id?: string;
  errors?: Array<{ code?: number; title?: string; message?: string }>;
};

export type MetaWebhookMessageObject = {
  from: string;
  id: string;
  timestamp: string;
  type: "text" | "button" | "interactive" | "image" | "document" | "audio" | "video" | "unknown";
  text?: { body: string };
  button?: { text: string; payload?: string };
  interactive?: {
    type?: string;
    button_reply?: { id: string; title: string };
    list_reply?: { id: string; title: string };
  };
};

export type MetaWebhookChangeValue = {
  messaging_product?: string;
  metadata?: {
    display_phone_number?: string;
    phone_number_id?: string;
  };
  message_template_id?: string | number;
  message_template_name?: string;
  event?: "APPROVED" | "REJECTED" | "PAUSED" | "DISABLED" | "PENDING";
  reason?: string;
  statuses?: MetaWebhookStatusObject[];
  messages?: MetaWebhookMessageObject[];
};

export type MetaWebhookChange = {
  field: string;
  value: MetaWebhookChangeValue;
};

export type MetaWebhookEntry = {
  id: string;
  changes: MetaWebhookChange[];
};

export type MetaWebhookPayload = {
  object: string;
  entry: MetaWebhookEntry[];
};

/**
 * Validates Meta Webhook HMAC-SHA256 signature from 'X-Hub-Signature-256'.
 */
export function verifyMetaWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string,
): boolean {
  if (!signatureHeader || !appSecret || !rawBody) return false;

  const [algo, hash] = signatureHeader.split("=");
  if (algo !== "sha256" || !hash) return false;

  try {
    const expectedHash = createHmac("sha256", appSecret)
      .update(rawBody, "utf8")
      .digest("hex");

    const expectedBuffer = Buffer.from(expectedHash, "hex");
    const actualBuffer = Buffer.from(hash, "hex");

    if (expectedBuffer.length !== actualBuffer.length) return false;
    return timingSafeEqual(expectedBuffer, actualBuffer);
  } catch {
    return false;
  }
}

/**
 * Ingests and processes a verified Meta Webhook payload.
 */
export async function processMetaWebhookPayload(payload: MetaWebhookPayload): Promise<{ ok: boolean; error?: string }> {
  if (payload.object !== "whatsapp_business_account" || !Array.isArray(payload.entry)) {
    return { ok: false, error: "Not a whatsapp_business_account payload." };
  }

  for (const entry of payload.entry) {
    const wabaId = entry.id;
    if (!Array.isArray(entry.changes)) continue;

    for (const change of entry.changes) {
      const field = change.field;
      const value = change.value;
      if (!value) continue;

      // Find channel by wabaId or phone_number_id
      const phoneNumberId = value.metadata?.phone_number_id;
      const channel = await prisma.whatsAppChannel.findFirst({
        where: {
          OR: [
            ...(phoneNumberId ? [{ phoneNumberId }] : []),
            ...(wabaId ? [{ wabaId }] : []),
          ],
        },
      });

      const tenantId = channel?.tenantId || "default";

      // 1. Template Status Updates (e.g. message_template_status_update)
      if (field === "message_template_status_update") {
        const metaTemplateId = String(value.message_template_id || "");
        const templateName = value.message_template_name;
        const event = value.event;
        const reason = value.reason;

        if (metaTemplateId || templateName) {
          const statusMap: Record<string, WhatsAppTemplateStatus> = {
            APPROVED: "APPROVED",
            REJECTED: "REJECTED",
            PAUSED: "PAUSED",
            DISABLED: "DISABLED",
            PENDING: "PENDING",
          };
          const templateStatus: WhatsAppTemplateStatus = (event && statusMap[event]) || "DRAFT";

          await prisma.whatsAppTemplate.updateMany({
            where: {
              tenantId,
              OR: [
                ...(metaTemplateId ? [{ metaTemplateId }] : []),
                ...(templateName ? [{ name: templateName }] : []),
              ],
            },
            data: {
              status: templateStatus,
              rejectionReason: reason || null,
              updatedAt: new Date(),
            },
          });
        }
      }

      // 2. Delivery Status Events (sent, delivered, read, failed)
      if (Array.isArray(value.statuses)) {
        for (const statusObj of value.statuses) {
          const wamid = statusObj.id;
          const status = statusObj.status; // 'sent' | 'delivered' | 'read' | 'failed'
          const timestamp = statusObj.timestamp ? new Date(parseInt(statusObj.timestamp, 10) * 1000) : new Date();

          // Find campaign message by wamid
          const campaignMsg = await prisma.whatsAppCampaignMessage.findUnique({
            where: { wamid },
            include: { campaign: true, recipient: true },
          });

          // Record raw event
          await prisma.whatsAppMessageEvent.create({
            data: {
              tenantId,
              wamid,
              eventType: status.toUpperCase(),
              occurredAt: timestamp,
              rawPayload: statusObj as unknown as Prisma.InputJsonValue,
              campaignId: campaignMsg?.campaignId || null,
              contactId: campaignMsg?.recipient?.contactId || null,
            },
          });

          if (campaignMsg) {
            const updateMsgData: Prisma.WhatsAppCampaignMessageUpdateInput = {};
            const updateRecipientData: Prisma.WhatsAppCampaignRecipientUpdateInput = {};
            const updateCampaignData: Prisma.WhatsAppCampaignUpdateInput = {};

            if (status === "sent") {
              const msgStatus: WhatsAppMessageStatus = "SENT";
              const rcpStatus: WhatsAppRecipientStatus = "SENT";
              updateMsgData.status = msgStatus;
              updateMsgData.sentAt = timestamp;
              updateRecipientData.status = rcpStatus;
            } else if (status === "delivered") {
              const msgStatus: WhatsAppMessageStatus = "DELIVERED";
              const rcpStatus: WhatsAppRecipientStatus = "DELIVERED";
              updateMsgData.status = msgStatus;
              updateMsgData.deliveredAt = timestamp;
              if (campaignMsg.status !== "DELIVERED" && campaignMsg.status !== "READ") {
                updateRecipientData.status = rcpStatus;
                updateRecipientData.deliveredAt = timestamp;
                updateCampaignData.deliveredCount = { increment: 1 };
              }
            } else if (status === "read") {
              const msgStatus: WhatsAppMessageStatus = "READ";
              const rcpStatus: WhatsAppRecipientStatus = "READ";
              updateMsgData.status = msgStatus;
              updateMsgData.readAt = timestamp;
              // Safe handling of out-of-order delivery
              if (!campaignMsg.deliveredAt) {
                updateMsgData.deliveredAt = timestamp;
              }
              if (campaignMsg.status !== "READ") {
                updateRecipientData.status = rcpStatus;
                updateRecipientData.readAt = timestamp;
                updateCampaignData.readCount = { increment: 1 };
              }
            } else if (status === "failed") {
              const msgStatus: WhatsAppMessageStatus = "FAILED";
              const rcpStatus: WhatsAppRecipientStatus = "FAILED";
              updateMsgData.status = msgStatus;
              updateMsgData.failedAt = timestamp;
              const errorText = statusObj.errors?.[0]?.title || statusObj.errors?.[0]?.message || "Message delivery failed";
              updateMsgData.errorMessage = errorText;
              updateRecipientData.status = rcpStatus;
              updateRecipientData.failedAt = timestamp;
              updateRecipientData.errorMessage = errorText;
              updateCampaignData.failedCount = { increment: 1 };
            }

            await prisma.$transaction([
              prisma.whatsAppCampaignMessage.update({
                where: { id: campaignMsg.id },
                data: updateMsgData,
              }),
              prisma.whatsAppCampaignRecipient.update({
                where: { id: campaignMsg.recipientId },
                data: updateRecipientData,
              }),
              ...(Object.keys(updateCampaignData).length > 0
                ? [
                    prisma.whatsAppCampaign.update({
                      where: { id: campaignMsg.campaignId },
                      data: updateCampaignData,
                    }),
                  ]
                : []),
            ]);

            // Update contact lastDeliveredAt / lastReadAt
            if (campaignMsg.recipient?.contactId) {
              await prisma.marketingContact.update({
                where: { id: campaignMsg.recipient.contactId },
                data: {
                  lastDeliveredAt: status === "delivered" || status === "read" ? timestamp : undefined,
                  lastReadAt: status === "read" ? timestamp : undefined,
                },
              });
            }
          }
        }
      }

      // 3. Inbound Messages & Replies
      if (Array.isArray(value.messages)) {
        for (const msg of value.messages) {
          const fromPhone = `+${msg.from.replace(/\D/g, "")}`;
          let messageText = "";

          if (msg.type === "text") {
            messageText = msg.text?.body || "";
          } else if (msg.type === "button") {
            messageText = msg.button?.text || "";
          } else if (msg.type === "interactive") {
            messageText =
              msg.interactive?.button_reply?.title ||
              msg.interactive?.list_reply?.title ||
              "";
          }

          // Compliance opt-out check: STOP, UNSUBSCRIBE, CANCEL
          if (isOptOutKeyword(messageText)) {
            await suppressPhone({
              tenantId,
              e164Phone: fromPhone,
              reason: "OPT_OUT",
              source: `INBOUND_KEYWORD_${messageText.toUpperCase()}`,
            });
          }

          // Link reply to recent campaign for this contact
          const contact = await prisma.marketingContact.findFirst({
            where: { tenantId, e164Phone: fromPhone },
          });

          if (contact) {
            await prisma.marketingContact.update({
              where: { id: contact.id },
              data: { lastRepliedAt: new Date() },
            });

            // Find most recent campaign recipient for this contact
            const recentRecipient = await prisma.whatsAppCampaignRecipient.findFirst({
              where: { contactId: contact.id },
              orderBy: { createdAt: "desc" },
            });

            if (recentRecipient) {
              await prisma.whatsAppCampaign.update({
                where: { id: recentRecipient.campaignId },
                data: { repliedCount: { increment: 1 } },
              });
            }
          }
        }
      }
    }
  }

  return { ok: true };
}
