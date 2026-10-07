import { prisma } from "@/lib/prisma";
import type { Prisma, WhatsAppTemplateCategory, WhatsAppHeaderType } from "@prisma/client";
import {
  createMetaTemplate,
  listMetaTemplates,
  type MetaCreateTemplateInput,
  type MetaTemplateComponent,
} from "./meta-client";
import { decryptSecureToken } from "./config";

export type TemplateButtonInput = {
  type: "QUICK_REPLY" | "URL" | "PHONE_NUMBER" | "OTP" | "FLOW";
  text: string;
  url?: string;
  phone_number?: string;
  example?: string[];
  flow_id?: string;
  flow_action?: string;
};

export type TemplateValidationInput = {
  name: string;
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
  headerType: "NONE" | "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT";
  headerText?: string;
  headerHandle?: string;
  bodyText: string;
  footerText?: string;
  buttons?: TemplateButtonInput[];
  exampleValues?: Record<string, string>;
};

export type TemplateValidationResult =
  | { valid: true; variableCount: number }
  | { valid: false; errors: string[] };

/**
 * Validates template name according to Meta requirements:
 * - Lowercase alphanumeric and underscores only
 * - Max 512 characters
 */
export function isValidTemplateName(name: string): boolean {
  if (!name || name.length > 512) return false;
  return /^[a-z0-9_]+$/.test(name);
}

/**
 * Validates sequential variable ordering: {{1}}, {{2}}, {{3}}...
 */
export function validateSequentialVariables(text: string): { valid: boolean; error?: string; count: number } {
  const matches = Array.from(text.matchAll(/\{\{(\d+)\}\}/g)).map((m) => parseInt(m[1], 10));
  if (matches.length === 0) return { valid: true, count: 0 };

  const unique = Array.from(new Set(matches)).sort((a, b) => a - b);
  for (let i = 0; i < unique.length; i++) {
    const expected = i + 1;
    if (unique[i] !== expected) {
      return {
        valid: false,
        error: `Template variables must be sequential starting at {{1}}. Found {{${unique[i]}}} where {{${expected}}} was expected.`,
        count: unique.length,
      };
    }
  }

  return { valid: true, count: unique.length };
}

/**
 * Validates the full structure of a template before submission to Meta.
 */
export function validateTemplateStructure(input: TemplateValidationInput): TemplateValidationResult {
  const errors: string[] = [];

  // Name validation
  if (!isValidTemplateName(input.name)) {
    errors.push("Template name must contain only lowercase letters, numbers, and underscores (max 512 characters).");
  }

  // Body text validation
  if (!input.bodyText || input.bodyText.trim().length === 0) {
    errors.push("Body text is required.");
  } else if (input.bodyText.length > 1024) {
    errors.push("Body text exceeds maximum allowed length of 1024 characters.");
  }

  const varCheck = validateSequentialVariables(input.bodyText);
  if (!varCheck.valid && varCheck.error) {
    errors.push(varCheck.error);
  }
  const variableCount = varCheck.count;

  // Variable sample validation (Meta mandates sample values for review)
  if (variableCount > 0) {
    for (let i = 1; i <= variableCount; i++) {
      const val = input.exampleValues?.[String(i)];
      if (!val || String(val).trim().length === 0) {
        errors.push(`Missing example sample value for variable {{${i}}}. Meta requires sample values.`);
      }
    }
  }

  // Header validation
  if (input.headerType === "TEXT") {
    if (!input.headerText || input.headerText.trim().length === 0) {
      errors.push("Text header requires header text content.");
    } else if (input.headerText.length > 60) {
      errors.push("Header text exceeds maximum allowed length of 60 characters.");
    }
  } else if (["IMAGE", "VIDEO", "DOCUMENT"].includes(input.headerType)) {
    if (!input.headerHandle) {
      errors.push(`${input.headerType} header requires a media handle uploaded via Meta Resumable Upload API.`);
    }
  }

  // Footer validation
  if (input.footerText && input.footerText.length > 60) {
    errors.push("Footer text exceeds maximum allowed length of 60 characters.");
  }

  // Buttons validation
  if (input.buttons && input.buttons.length > 0) {
    if (input.buttons.length > 10) {
      errors.push("Templates support a maximum of 10 buttons.");
    }

    let urlButtonCount = 0;
    let phoneButtonCount = 0;
    let quickReplyCount = 0;

    const allowedButtonTypes = new Set(["QUICK_REPLY", "URL", "PHONE_NUMBER", "OTP", "FLOW"]);

    for (let idx = 0; idx < input.buttons.length; idx++) {
      const btn = input.buttons[idx];
      if (!allowedButtonTypes.has(btn.type)) {
        errors.push(`Button ${idx + 1} has unsupported type: '${btn.type}'.`);
        continue;
      }
      if (!btn.text || btn.text.trim().length === 0) {
        errors.push(`Button ${idx + 1} must have a label.`);
      } else if (btn.text.length > 25) {
        errors.push(`Button ${idx + 1} label exceeds maximum 25 characters.`);
      }

      if (btn.type === "URL") {
        urlButtonCount++;
        if (!btn.url || !btn.url.startsWith("http")) {
          errors.push(`Button ${idx + 1} must specify a valid http/https URL.`);
        }
        if (btn.url && btn.url.includes("{{1}}") && (!btn.example || btn.example.length === 0)) {
          errors.push(`Dynamic URL Button ${idx + 1} requires a sample variable value.`);
        }
      } else if (btn.type === "PHONE_NUMBER") {
        phoneButtonCount++;
        if (!btn.phone_number || btn.phone_number.replace(/\D/g, "").length < 7) {
          errors.push(`Button ${idx + 1} must specify a valid phone number.`);
        }
      } else if (btn.type === "QUICK_REPLY") {
        quickReplyCount++;
      }
    }

    if (urlButtonCount > 2) {
      errors.push("Templates support a maximum of 2 URL buttons.");
    }
    if (phoneButtonCount > 1) {
      errors.push("Templates support a maximum of 1 Phone Number button.");
    }
    if (quickReplyCount > 10) {
      errors.push("Templates support a maximum of 10 Quick Reply buttons.");
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, variableCount };
}

/**
 * Builds Meta API compliant template payload.
 */
export function buildMetaTemplatePayload(input: {
  name: string;
  language: string;
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
  headerType: "NONE" | "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT";
  headerText?: string;
  headerHandle?: string;
  bodyText: string;
  footerText?: string;
  buttons?: TemplateButtonInput[];
  exampleValues?: Record<string, string>;
}): MetaCreateTemplateInput {
  const components: MetaTemplateComponent[] = [];

  // Header
  if (input.headerType === "TEXT" && input.headerText) {
    components.push({
      type: "HEADER",
      format: "TEXT",
      text: input.headerText,
    });
  } else if (["IMAGE", "VIDEO", "DOCUMENT"].includes(input.headerType) && input.headerHandle) {
    components.push({
      type: "HEADER",
      format: input.headerType as "IMAGE" | "VIDEO" | "DOCUMENT",
      example: {
        header_handle: [input.headerHandle],
      },
    });
  }

  // Body
  const bodyComponent: MetaTemplateComponent = {
    type: "BODY",
    text: input.bodyText,
  };

  const varMatches = Array.from(input.bodyText.matchAll(/\{\{(\d+)\}\}/g)).map((m) => parseInt(m[1], 10));
  const uniqueVars = Array.from(new Set(varMatches)).sort((a, b) => a - b);
  if (uniqueVars.length > 0 && input.exampleValues) {
    const examplesRow: string[] = uniqueVars.map((v) => input.exampleValues?.[String(v)] || `Sample ${v}`);
    bodyComponent.example = {
      body_text: [examplesRow],
    };
  }
  components.push(bodyComponent);

  // Footer
  if (input.footerText && input.footerText.trim()) {
    components.push({
      type: "FOOTER",
      text: input.footerText.trim(),
    });
  }

  // Buttons
  if (input.buttons && input.buttons.length > 0) {
    components.push({
      type: "BUTTONS",
      buttons: input.buttons.map((btn) => ({
        type: btn.type,
        text: btn.text,
        url: btn.url,
        phone_number: btn.phone_number,
        example: btn.example,
      })),
    });
  }

  return {
    name: input.name,
    language: input.language || "en_US",
    category: input.category,
    components,
  };
}

/**
 * Creates or updates a template locally and submits it to Meta for approval.
 */
export async function createAndSubmitTemplate(input: {
  tenantId: string;
  channelId: string;
  name: string;
  language: string;
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
  headerType: "NONE" | "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT";
  headerText?: string;
  headerHandle?: string;
  bodyText: string;
  footerText?: string;
  buttons?: TemplateButtonInput[];
  exampleValues?: Record<string, string>;
  actorUserId?: string;
}) {
  const validation = validateTemplateStructure({
    name: input.name,
    category: input.category,
    headerType: input.headerType,
    headerText: input.headerText,
    headerHandle: input.headerHandle,
    bodyText: input.bodyText,
    footerText: input.footerText,
    buttons: input.buttons,
    exampleValues: input.exampleValues,
  });

  if (!validation.valid) {
    return { ok: false, error: validation.errors.join("; ") };
  }

  const channel = await prisma.whatsAppChannel.findFirst({
    where: { id: input.channelId, tenantId: input.tenantId },
  });

  if (!channel) {
    return { ok: false, error: "WhatsApp Channel not found or unauthorized." };
  }

  const accessToken = decryptSecureToken(channel.encryptedAccessToken || "");
  if (!accessToken) {
    return { ok: false, error: "Channel does not have a valid Meta access token configured." };
  }

  // Check if template exists
  const existing = await prisma.whatsAppTemplate.findUnique({
    where: {
      tenantId_name_language: {
        tenantId: input.tenantId,
        name: input.name,
        language: input.language,
      },
    },
    include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } },
  });

  // Do not overwrite an APPROVED template directly in place without saving a version snapshot
  if (existing && existing.status === "APPROVED") {
    const nextVersion = (existing.versions[0]?.versionNumber || 1) + 1;
    await prisma.whatsAppTemplateVersion.create({
      data: {
        templateId: existing.id,
        versionNumber: nextVersion,
        headerType: existing.headerType,
        headerContent: existing.headerContent,
        bodyText: existing.bodyText,
        footerText: existing.footerText,
        buttons: (existing.buttons as Prisma.InputJsonValue) ?? undefined,
        exampleValues: (existing.exampleValues as Prisma.InputJsonValue) ?? undefined,
        metaStatus: existing.status,
      },
    });
  }

  // Build Meta payload
  const metaPayload = buildMetaTemplatePayload({
    name: input.name,
    language: input.language,
    category: input.category,
    headerType: input.headerType,
    headerText: input.headerText,
    headerHandle: input.headerHandle,
    bodyText: input.bodyText,
    footerText: input.footerText,
    buttons: input.buttons,
    exampleValues: input.exampleValues,
  });

  // Submit to Meta (or mock)
  const metaResult = await createMetaTemplate({
    wabaId: channel.wabaId,
    accessToken,
    template: metaPayload,
  });

  if (!metaResult.ok) {
    return {
      ok: false,
      error: `Meta rejected template: ${metaResult.error}`,
      statusCode: metaResult.statusCode,
    };
  }

  const metaId = metaResult.data.id;
  const initialStatus = metaResult.data.status || "PENDING";

  // Upsert local record
  const categoryMap: Record<string, WhatsAppTemplateCategory> = {
    MARKETING: "MARKETING",
    UTILITY: "UTILITY",
    AUTHENTICATION: "AUTHENTICATION",
  };
  const prismaCategory = categoryMap[input.category] || "MARKETING";

  const headerTypeMap: Record<string, WhatsAppHeaderType> = {
    NONE: "NONE",
    TEXT: "TEXT",
    IMAGE: "IMAGE",
    VIDEO: "VIDEO",
    DOCUMENT: "DOCUMENT",
  };
  const prismaHeaderType = headerTypeMap[input.headerType] || "NONE";

  const template = await prisma.whatsAppTemplate.upsert({
    where: {
      tenantId_name_language: {
        tenantId: input.tenantId,
        name: input.name,
        language: input.language,
      },
    },
    update: {
      channelId: channel.id,
      metaTemplateId: metaId,
      category: prismaCategory,
      status: initialStatus as "PENDING" | "APPROVED",
      headerType: prismaHeaderType,
      headerContent: input.headerText || null,
      headerHandle: input.headerHandle || null,
      bodyText: input.bodyText,
      footerText: input.footerText || null,
      buttons: (input.buttons as unknown as Prisma.InputJsonValue) || undefined,
      exampleValues: (input.exampleValues as unknown as Prisma.InputJsonValue) || undefined,
      hasVariables: validation.variableCount > 0,
      variableCount: validation.variableCount,
      rejectionReason: null,
      updatedAt: new Date(),
    },
    create: {
      tenantId: input.tenantId,
      channelId: channel.id,
      metaTemplateId: metaId,
      name: input.name,
      language: input.language,
      category: prismaCategory,
      status: initialStatus as "PENDING" | "APPROVED",
      headerType: prismaHeaderType,
      headerContent: input.headerText || null,
      headerHandle: input.headerHandle || null,
      bodyText: input.bodyText,
      footerText: input.footerText || null,
      buttons: (input.buttons as unknown as Prisma.InputJsonValue) || undefined,
      exampleValues: (input.exampleValues as unknown as Prisma.InputJsonValue) || undefined,
      hasVariables: validation.variableCount > 0,
      variableCount: validation.variableCount,
    },
  });

  // Audit Log
  await prisma.whatsAppAuditLog.create({
    data: {
      tenantId: input.tenantId,
      actorUserId: input.actorUserId,
      action: "WHATSAPP_TEMPLATE_CREATED",
      entityType: "WhatsAppTemplate",
      entityId: template.id,
      details: {
        name: input.name,
        category: input.category,
        metaId,
        status: initialStatus,
      },
    },
  });

  return {
    ok: true,
    templateId: template.id,
    metaId,
    status: initialStatus,
  };
}

/**
 * Synchronizes templates from Meta Graph API into the local database idempotently.
 */
export async function syncMetaTemplatesToDb(input: {
  tenantId: string;
  channelId: string;
  actorUserId?: string;
}) {
  const channel = await prisma.whatsAppChannel.findFirst({
    where: { id: input.channelId, tenantId: input.tenantId },
  });

  if (!channel) {
    return { ok: false, error: "WhatsApp Channel not found." };
  }

  const accessToken = decryptSecureToken(channel.encryptedAccessToken || "");
  if (!accessToken) {
    return { ok: false, error: "Channel does not have a valid Meta access token." };
  }

  const metaListResult = await listMetaTemplates(channel.wabaId, accessToken);
  if (!metaListResult.ok) {
    return {
      ok: false,
      error: `Failed to fetch templates from Meta: ${metaListResult.error}`,
    };
  }

  let createdCount = 0;
  let updatedCount = 0;

  for (const metaTpl of metaListResult.data) {
    let headerType: WhatsAppHeaderType = "NONE";
    let headerContent: string | null = null;
    let bodyText = "";
    let footerText: string | null = null;
    let buttons: unknown[] | null = null;
    let variableCount = 0;

    for (const comp of metaTpl.components) {
      if (comp.type === "HEADER") {
        if (comp.format === "TEXT") {
          headerType = "TEXT";
          headerContent = comp.text || null;
        } else if (comp.format) {
          headerType = comp.format as WhatsAppHeaderType;
        }
      } else if (comp.type === "BODY") {
        bodyText = comp.text || "";
        const m = Array.from(bodyText.matchAll(/\{\{(\d+)\}\}/g));
        variableCount = new Set(m.map((match) => match[1])).size;
      } else if (comp.type === "FOOTER") {
        footerText = comp.text || null;
      } else if (comp.type === "BUTTONS" && Array.isArray(comp.buttons)) {
        buttons = comp.buttons;
      }
    }

    const validStatusSet = new Set(["DRAFT", "PENDING", "APPROVED", "REJECTED", "PAUSED", "DISABLED"]);
    const status = validStatusSet.has(metaTpl.status)
      ? (metaTpl.status as "DRAFT" | "PENDING" | "APPROVED" | "REJECTED" | "PAUSED" | "DISABLED")
      : "DRAFT";

    const qualityRating = metaTpl.quality_score?.score || null;

    const categoryMap: Record<string, WhatsAppTemplateCategory> = {
      MARKETING: "MARKETING",
      UTILITY: "UTILITY",
      AUTHENTICATION: "AUTHENTICATION",
    };
    const mappedCategory = categoryMap[metaTpl.category] || "MARKETING";

    const existing = await prisma.whatsAppTemplate.findUnique({
      where: {
        tenantId_name_language: {
          tenantId: input.tenantId,
          name: metaTpl.name,
          language: metaTpl.language,
        },
      },
    });

    if (existing) {
      await prisma.whatsAppTemplate.update({
        where: { id: existing.id },
        data: {
          metaTemplateId: metaTpl.id,
          status,
          category: mappedCategory,
          qualityRating,
          rejectionReason: metaTpl.rejected_reason || null,
          bodyText: bodyText || existing.bodyText,
          headerType,
          headerContent,
          footerText,
          buttons: (buttons as unknown as Prisma.InputJsonValue) || (existing.buttons as Prisma.InputJsonValue),
          hasVariables: variableCount > 0,
          variableCount,
          updatedAt: new Date(),
        },
      });
      updatedCount++;
    } else {
      await prisma.whatsAppTemplate.create({
        data: {
          tenantId: input.tenantId,
          channelId: channel.id,
          metaTemplateId: metaTpl.id,
          name: metaTpl.name,
          language: metaTpl.language,
          category: mappedCategory,
          status,
          qualityRating,
          rejectionReason: metaTpl.rejected_reason || null,
          headerType,
          headerContent,
          bodyText: bodyText || `Meta Template ${metaTpl.name}`,
          footerText,
          buttons: (buttons as unknown as Prisma.InputJsonValue) || undefined,
          hasVariables: variableCount > 0,
          variableCount,
        },
      });
      createdCount++;
    }
  }

  // Update channel lastSyncedAt
  await prisma.whatsAppChannel.update({
    where: { id: channel.id },
    data: { lastSyncedAt: new Date() },
  });

  const syncLog = await prisma.whatsAppTemplateSyncLog.create({
    data: {
      tenantId: input.tenantId,
      channelId: channel.id,
      status: "SUCCESS",
      templatesCreated: createdCount,
      templatesUpdated: updatedCount,
    },
  });

  return {
    ok: true,
    created: createdCount,
    updated: updatedCount,
    total: metaListResult.data.length,
    syncLogId: syncLog.id,
  };
}

export const syncTemplatesFromMeta = syncMetaTemplatesToDb;
