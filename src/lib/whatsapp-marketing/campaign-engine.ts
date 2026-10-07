import { prisma } from "@/lib/prisma";
import type { Prisma, WhatsAppCampaignStatus } from "@prisma/client";
import {
  DEFAULT_DISPATCH_RATE_PER_SECOND,
  MAX_RETRY_ATTEMPTS,
  RETRY_BASE_DELAY_MS,
  MAX_PREVIEW_LIMIT,
  decryptSecureToken,
} from "./config";
import { sendTemplateMessage } from "./meta-client";
import { isPhoneSuppressed } from "./contact-service";

export type VariableMapping = Record<string, { source: "contact_field" | "static"; fieldOrValue: string }>;

/**
 * Resolves template variables for a specific contact given the variable mapping.
 */
export function resolveContactVariables(
  mapping: VariableMapping,
  contact: {
    fullName: string;
    e164Phone: string;
    email?: string | null;
    customFields?: Record<string, unknown> | null;
  },
): Record<string, string> {
  const resolved: Record<string, string> = {};

  for (const [varIndex, config] of Object.entries(mapping)) {
    if (config.source === "static") {
      resolved[varIndex] = config.fieldOrValue;
    } else {
      switch (config.fieldOrValue) {
        case "fullName":
          resolved[varIndex] = contact.fullName || "Friend";
          break;
        case "firstName":
          resolved[varIndex] = contact.fullName.split(" ")[0] || "Friend";
          break;
        case "phone":
          resolved[varIndex] = contact.e164Phone;
          break;
        case "email":
          resolved[varIndex] = contact.email || "";
          break;
        default:
          resolved[varIndex] = String((contact.customFields && contact.customFields[config.fieldOrValue]) || "");
          break;
      }
    }
  }

  return resolved;
}

/**
 * Builds preview for up to 20 personalized recipients.
 */
export async function generateCampaignPreview(input: {
  tenantId: string;
  templateId: string;
  groupIds?: string[];
  variableMappings: VariableMapping;
  limit?: number;
}) {
  const template = await prisma.whatsAppTemplate.findFirst({
    where: { id: input.templateId, tenantId: input.tenantId },
  });

  if (!template) {
    return { ok: false, error: "Template not found." };
  }

  const whereClause: Prisma.MarketingContactWhereInput = {
    tenantId: input.tenantId,
    optInStatus: "OPTED_IN",
    isBlocked: false,
  };

  if (input.groupIds && input.groupIds.length > 0) {
    whereClause.groupMemberships = {
      some: { groupId: { in: input.groupIds } },
    };
  }

  const contacts = await prisma.marketingContact.findMany({
    where: whereClause,
    take: input.limit || MAX_PREVIEW_LIMIT,
  });

  const previewItems = [];
  for (const c of contacts) {
    const isSuppressed = await isPhoneSuppressed(input.tenantId, c.e164Phone);
    const resolvedVars = resolveContactVariables(input.variableMappings, {
      ...c,
      customFields: (c.customFields as Record<string, unknown>) || null,
    });

    let renderedBody = template.bodyText;
    for (const [varNum, val] of Object.entries(resolvedVars)) {
      renderedBody = renderedBody.replaceAll(`{{${varNum}}}`, val);
    }

    previewItems.push({
      contactId: c.id,
      fullName: c.fullName,
      phone: c.e164Phone,
      email: c.email,
      isSuppressed,
      resolvedVariables: resolvedVars,
      renderedMessage: renderedBody,
    });
  }

  return {
    ok: true,
    totalAudienceSampled: contacts.length,
    template: {
      name: template.name,
      category: template.category,
      headerType: template.headerType,
      headerContent: template.headerContent,
      bodyText: template.bodyText,
      footerText: template.footerText,
    },
    previews: previewItems,
  };
}

/**
 * Sends a single test message using a template to an admin or test phone number.
 */
export async function sendCampaignTestMessage(input: {
  tenantId: string;
  channelId: string;
  templateId: string;
  testPhone: string;
  variableValues?: Record<string, string>;
}) {
  const [channel, template] = await Promise.all([
    prisma.whatsAppChannel.findFirst({ where: { id: input.channelId, tenantId: input.tenantId } }),
    prisma.whatsAppTemplate.findFirst({ where: { id: input.templateId, tenantId: input.tenantId } }),
  ]);

  if (!channel || !template) {
    return { ok: false, error: "Channel or Template not found." };
  }

  const accessToken = decryptSecureToken(channel.encryptedAccessToken || "");
  if (!accessToken) {
    return { ok: false, error: "Channel access token missing." };
  }

  const parameters: Array<{ type: "text"; text: string }> = [];
  if (template.variableCount > 0) {
    for (let i = 1; i <= template.variableCount; i++) {
      const val = input.variableValues?.[String(i)] || `TestVar${i}`;
      parameters.push({ type: "text", text: val });
    }
  }

  const components: Array<{
    type: "header" | "body" | "button";
    parameters: Array<{ type: "text"; text: string }>;
  }> = [];
  if (parameters.length > 0) {
    components.push({
      type: "body",
      parameters,
    });
  }

  const sendResult = await sendTemplateMessage({
    phoneNumberId: channel.phoneNumberId,
    accessToken,
    to: input.testPhone,
    templateName: template.name,
    languageCode: template.language,
    components,
  });

  return sendResult;
}

/**
 * Queues and initializes a bulk WhatsApp campaign with suppression checks.
 */
export async function createAndQueueCampaign(input: {
  tenantId: string;
  channelId: string;
  templateId: string;
  name: string;
  groupIds?: string[];
  contactIds?: string[];
  variableMappings: VariableMapping;
  scheduledAt?: string | null;
  timezone?: string;
  actorUserId?: string;
}) {
  const [channel, template] = await Promise.all([
    prisma.whatsAppChannel.findFirst({ where: { id: input.channelId, tenantId: input.tenantId } }),
    prisma.whatsAppTemplate.findFirst({ where: { id: input.templateId, tenantId: input.tenantId } }),
  ]);

  if (!channel || !template) {
    return { ok: false, error: "Channel or Template not found." };
  }

  if (template.status !== "APPROVED") {
    return {
      ok: false,
      error: `Template is currently in '${template.status}' state. Only Meta APPROVED templates can be used for bulk marketing.`,
    };
  }

  // 1. Gather audience
  const audienceWhere: Prisma.MarketingContactWhereInput = {
    tenantId: input.tenantId,
    optInStatus: "OPTED_IN",
    isBlocked: false,
  };

  if (input.contactIds && input.contactIds.length > 0) {
    audienceWhere.id = { in: input.contactIds };
  } else if (input.groupIds && input.groupIds.length > 0) {
    audienceWhere.groupMemberships = {
      some: { groupId: { in: input.groupIds } },
    };
  }

  const contacts = await prisma.marketingContact.findMany({
    where: audienceWhere,
  });

  if (contacts.length === 0) {
    return { ok: false, error: "No opted-in, eligible contacts found for this audience selection." };
  }

  const isImmediate = !input.scheduledAt || new Date(input.scheduledAt) <= new Date();
  const initialStatus: WhatsAppCampaignStatus = isImmediate ? "RUNNING" : "SCHEDULED";

  // 2. Create campaign record
  const campaign = await prisma.whatsAppCampaign.create({
    data: {
      tenantId: input.tenantId,
      channelId: channel.id,
      templateId: template.id,
      templateLanguage: template.language,
      name: input.name,
      status: initialStatus,
      scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
      startedAt: isImmediate ? new Date() : null,
      totalRecipients: contacts.length,
      variableMappings: input.variableMappings as unknown as Prisma.InputJsonValue,
      createdById: input.actorUserId,
      timezone: input.timezone || "Asia/Kolkata",
    },
  });

  // 3. Queue recipients with idempotency keys
  const recipientData: Prisma.WhatsAppCampaignRecipientCreateManyInput[] = [];
  for (const c of contacts) {
    const isSuppressed = await isPhoneSuppressed(input.tenantId, c.e164Phone);
    const resolvedVars = resolveContactVariables(input.variableMappings, {
      ...c,
      customFields: (c.customFields as Record<string, unknown>) || null,
    });
    const idempotencyKey = `${campaign.id}:${c.id}:1`;

    recipientData.push({
      campaignId: campaign.id,
      contactId: c.id,
      e164Phone: c.e164Phone,
      status: isSuppressed ? "SKIPPED" : "QUEUED",
      skipReason: isSuppressed ? "CONTACT_SUPPRESSED" : null,
      resolvedVariables: resolvedVars as unknown as Prisma.InputJsonValue,
      idempotencyKey,
    });
  }

  await prisma.whatsAppCampaignRecipient.createMany({
    data: recipientData,
    skipDuplicates: true,
  });

  // Audit log
  await prisma.whatsAppAuditLog.create({
    data: {
      tenantId: input.tenantId,
      actorUserId: input.actorUserId,
      action: "WHATSAPP_CAMPAIGN_QUEUED",
      entityType: "WhatsAppCampaign",
      entityId: campaign.id,
      details: {
        campaignName: input.name,
        totalRecipients: contacts.length,
        isImmediate,
      },
    },
  });

  // 4. If immediate, kick off asynchronous worker
  if (isImmediate) {
    void processCampaignQueue(campaign.id).catch((err: unknown) => {
      console.error(`[CAMPAIGN_WORKER_ERROR] Campaign ${campaign.id}:`, err);
    });
  }

  return {
    ok: true,
    campaignId: campaign.id,
    totalRecipients: contacts.length,
    status: campaign.status,
  };
}

/**
 * Worker function that throttles message dispatch with rate-limiting, exponential backoff,
 * idempotency checks, and pauses gracefully on demand.
 */
export async function processCampaignQueue(campaignId: string) {
  const campaign = await prisma.whatsAppCampaign.findUnique({
    where: { id: campaignId },
    include: { channel: true, template: true },
  });

  if (!campaign || campaign.status !== "RUNNING") {
    return;
  }

  const accessToken = decryptSecureToken(campaign.channel.encryptedAccessToken || "");
  if (!accessToken) {
    await prisma.whatsAppCampaign.update({
      where: { id: campaign.id },
      data: { status: "FAILED" },
    });
    return;
  }

  // Fetch pending queued recipients
  const recipients = await prisma.whatsAppCampaignRecipient.findMany({
    where: { campaignId: campaign.id, status: "QUEUED" },
    orderBy: { createdAt: "asc" },
  });

  const ratePerSecond = DEFAULT_DISPATCH_RATE_PER_SECOND; // 20 msgs/sec
  const delayBetweenMsgs = Math.floor(1000 / ratePerSecond);

  for (const recipient of recipients) {
    // Check if campaign was paused or cancelled in between
    const liveCheck = await prisma.whatsAppCampaign.findUnique({
      where: { id: campaign.id },
      select: { status: true },
    });

    if (!liveCheck || liveCheck.status !== "RUNNING") {
      break;
    }

    const resolvedVars = (recipient.resolvedVariables as Record<string, string>) || {};
    const parameters: Array<{ type: "text"; text: string }> = [];

    if (campaign.template.variableCount > 0) {
      for (let i = 1; i <= campaign.template.variableCount; i++) {
        parameters.push({
          type: "text",
          text: resolvedVars[String(i)] || " ",
        });
      }
    }

    const components: Array<{
      type: "header" | "body" | "button";
      parameters: Array<{ type: "text"; text: string }>;
    }> = [];
    if (parameters.length > 0) {
      components.push({
        type: "body",
        parameters,
      });
    }

    // Call Meta API
    let attempt = 0;
    let sendResult: Awaited<ReturnType<typeof sendTemplateMessage>> | null = null;

    while (attempt < MAX_RETRY_ATTEMPTS) {
      attempt++;
      sendResult = await sendTemplateMessage({
        phoneNumberId: campaign.channel.phoneNumberId,
        accessToken,
        to: recipient.e164Phone,
        templateName: campaign.template.name,
        languageCode: campaign.template.language,
        components,
      });

      if (sendResult.ok) break;

      // Rate limit backoff (429 or rate limit code)
      if (sendResult.statusCode === 429 || sendResult.error?.includes("rate limit")) {
        const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
        await new Promise((r) => setTimeout(r, delay));
      } else {
        break; // Non-retryable error
      }
    }

    if (sendResult?.ok && sendResult.data?.messages?.[0]?.id) {
      const wamid = sendResult.data.messages[0].id;

      await prisma.$transaction([
        prisma.whatsAppCampaignRecipient.update({
          where: { id: recipient.id },
          data: {
            status: "SENT",
            sentAt: new Date(),
          },
        }),
        prisma.whatsAppCampaignMessage.create({
          data: {
            campaignId: campaign.id,
            recipientId: recipient.id,
            wamid,
            status: "SENT",
            sentAt: new Date(),
          },
        }),
        prisma.whatsAppCampaign.update({
          where: { id: campaign.id },
          data: {
            sentCount: { increment: 1 },
          },
        }),
      ]);
    } else {
      const errorMsg = (!sendResult?.ok ? (sendResult as { error?: string })?.error : undefined) || "Unknown send failure";
      await prisma.$transaction([
        prisma.whatsAppCampaignRecipient.update({
          where: { id: recipient.id },
          data: {
            status: "FAILED",
            failedAt: new Date(),
            errorMessage: errorMsg,
          },
        }),
        prisma.whatsAppCampaign.update({
          where: { id: campaign.id },
          data: {
            failedCount: { increment: 1 },
          },
        }),
      ]);
    }

    // Rate-limiting delay
    await new Promise((resolve) => setTimeout(resolve, delayBetweenMsgs));
  }

  // Check if all queued are processed
  const remaining = await prisma.whatsAppCampaignRecipient.count({
    where: { campaignId: campaign.id, status: "QUEUED" },
  });

  if (remaining === 0) {
    await prisma.whatsAppCampaign.update({
      where: { id: campaign.id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
      },
    });
  }
}

/**
 * Pauses an active running campaign.
 */
export async function pauseCampaign(tenantId: string, campaignId: string, _actorUserId?: string) {
  void _actorUserId;
  const campaign = await prisma.whatsAppCampaign.findFirst({
    where: { id: campaignId, tenantId },
  });

  if (!campaign) return { ok: false, error: "Campaign not found." };
  if (campaign.status !== "RUNNING" && campaign.status !== "SCHEDULED") {
    return { ok: false, error: `Cannot pause campaign in '${campaign.status}' state.` };
  }

  await prisma.whatsAppCampaign.update({
    where: { id: campaign.id },
    data: { status: "PAUSED" },
  });

  return { ok: true, status: "PAUSED" };
}

/**
 * Resumes a paused campaign.
 */
export async function resumeCampaign(tenantId: string, campaignId: string, _actorUserId?: string) {
  void _actorUserId;
  const campaign = await prisma.whatsAppCampaign.findFirst({
    where: { id: campaignId, tenantId },
  });

  if (!campaign) return { ok: false, error: "Campaign not found." };
  if (campaign.status !== "PAUSED") {
    return { ok: false, error: `Cannot resume campaign in '${campaign.status}' state.` };
  }

  await prisma.whatsAppCampaign.update({
    where: { id: campaign.id },
    data: { status: "RUNNING" },
  });

  // Re-trigger queue processing
  void processCampaignQueue(campaign.id).catch((err: unknown) => {
    console.error(`[CAMPAIGN_RESUME_ERROR] Campaign ${campaign.id}:`, err);
  });

  return { ok: true, status: "RUNNING" };
}

/**
 * Cancels a campaign.
 */
export async function cancelCampaign(tenantId: string, campaignId: string, _actorUserId?: string) {
  void _actorUserId;
  const campaign = await prisma.whatsAppCampaign.findFirst({
    where: { id: campaignId, tenantId },
  });

  if (!campaign) return { ok: false, error: "Campaign not found." };
  if (campaign.status === "COMPLETED" || campaign.status === "CANCELLED") {
    return { ok: false, error: `Campaign already ${campaign.status.toLowerCase()}.` };
  }

  await prisma.whatsAppCampaign.update({
    where: { id: campaign.id },
    data: { status: "CANCELLED" },
  });

  return { ok: true, status: "CANCELLED" };
}

/**
 * Retries failed recipients in a campaign.
 */
export async function retryFailedCampaignRecipients(tenantId: string, campaignId: string, _actorUserId?: string) {
  void _actorUserId;
  const campaign = await prisma.whatsAppCampaign.findFirst({
    where: { id: campaignId, tenantId },
  });

  if (!campaign) return { ok: false, error: "Campaign not found." };

  const failedRecipients = await prisma.whatsAppCampaignRecipient.findMany({
    where: { campaignId: campaign.id, status: "FAILED" },
  });

  if (failedRecipients.length === 0) {
    return { ok: false, error: "No failed recipients found to retry." };
  }

  await prisma.whatsAppCampaignRecipient.updateMany({
    where: { campaignId: campaign.id, status: "FAILED" },
    data: {
      status: "QUEUED",
      failedAt: null,
      errorMessage: null,
    },
  });

  await prisma.whatsAppCampaign.update({
    where: { id: campaign.id },
    data: {
      status: "RUNNING",
      failedCount: { decrement: failedRecipients.length },
    },
  });

  void processCampaignQueue(campaign.id).catch((err: unknown) => {
    console.error(`[CAMPAIGN_RETRY_ERROR] Campaign ${campaign.id}:`, err);
  });

  return { ok: true, retryingCount: failedRecipients.length };
}

export const retryFailedRecipients = retryFailedCampaignRecipients;

/**
 * Executes or triggers the campaign queue worker for a specific campaign ID.
 */
export async function executeCampaignQueueWorker(
  campaignId: string,
  _options?: { batchLimit?: number; dispatchRate?: number },
) {
  void _options;
  try {
    await processCampaignQueue(campaignId);
    return { ok: true, campaignId };
  } catch (error: unknown) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed executing campaign worker",
    };
  }
}
