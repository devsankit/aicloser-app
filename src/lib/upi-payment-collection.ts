import "server-only";

import { createHmac, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import QRCode from "qrcode";
import { Prisma } from "@prisma/client";

import type { AppRole, SessionUser } from "@/lib/auth/types";
import { prisma } from "@/lib/prisma";

export const DEFAULT_TENANT_ID = "tenant-gigxomi";
export type PricingOperation = "ADD" | "SUBTRACT" | "MULTIPLY" | "DIVIDE";
export const DEFAULT_DURATION_MULTIPLIERS = { DAY: 0.5, MONTH: 1, YEAR: 12, quantityOperation: "MULTIPLY", durationOperation: "MULTIPLY" } as const;
const LINK_EXPIRY_KEY = "__upiLinkValidity";

export const DEFAULT_UPI_FIELDS = [
  { fieldKey: "customerName", label: "Customer name", visible: true, required: true, surface: "CLOSER", reportVisible: true, sortOrder: 10 },
  { fieldKey: "customerPhone", label: "Customer phone", visible: true, required: false, surface: "CLOSER", reportVisible: true, sortOrder: 20 },
  { fieldKey: "customerEmail", label: "Customer email", visible: true, required: false, surface: "CLOSER", reportVisible: true, sortOrder: 30 },
  { fieldKey: "productName", label: "Package / product", visible: true, required: false, surface: "CLOSER", reportVisible: true, sortOrder: 40 },
  { fieldKey: "customerNote", label: "Notes", visible: true, required: false, surface: "CLOSER", reportVisible: true, sortOrder: 50 },
  { fieldKey: "utrReference", label: "UTR / payment reference", visible: true, required: false, surface: "CUSTOMER", reportVisible: true, sortOrder: 10 },
];

type TenantContext = Pick<SessionUser, "userId" | "role" | "tenantId">;

export function tenantForSession(session: TenantContext, requestedTenantId?: string | null) {
  if (session.role === "SUPER_ADMIN") throw new Error("Super Admin cannot operate tenant payment data.");
  const tenantId = session.tenantId?.trim();
  if (!tenantId) throw new Error("Tenant workspace is required for this action.");
  // The request body/query string is never allowed to change the tenant scope.
  // Keep the parameter for backwards-compatible callers, but deliberately ignore it.
  void requestedTenantId;
  return tenantId;
}

function asNumber(value: Prisma.Decimal | number | string | null | undefined) {
  if (value === null || value === undefined) return 0;
  return typeof value === "number" ? value : Number(value.toString());
}

function cleanText(value: unknown, max = 500) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function cleanPositiveNumber(value: unknown, label: string) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) throw new Error(`${label} must be greater than zero.`);
  return number;
}

function parseLinkValidity(value: unknown, unit: unknown) {
  const amount = Math.floor(Number(value));
  if (!Number.isFinite(amount) || amount < 1) throw new Error("Link validity must be at least 1.");
  const normalizedUnit = String(unit || "DAY").toUpperCase();
  if (!(normalizedUnit === "MINUTE" || normalizedUnit === "HOUR" || normalizedUnit === "DAY")) throw new Error("Link validity unit is invalid.");
  const minutes = amount * (normalizedUnit === "MINUTE" ? 1 : normalizedUnit === "HOUR" ? 60 : 1_440);
  if (minutes > 43_200) throw new Error("Link validity cannot be longer than 30 days.");
  return { value: amount, unit: normalizedUnit as "MINUTE" | "HOUR" | "DAY", expiresAt: new Date(Date.now() + minutes * 60_000) };
}

function linkExpiresAt(link: { customFields?: unknown }) {
  const fields = link.customFields && typeof link.customFields === "object" ? link.customFields as Record<string, unknown> : {};
  const raw = fields[LINK_EXPIRY_KEY] && typeof fields[LINK_EXPIRY_KEY] === "object" ? fields[LINK_EXPIRY_KEY] as Record<string, unknown> : null;
  if (!raw || typeof raw.expiresAt !== "string") return null;
  const date = new Date(raw.expiresAt);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseOperation(value: unknown): PricingOperation {
  return value === "ADD" || value === "SUBTRACT" || value === "DIVIDE" ? value : "MULTIPLY";
}

function parseMultipliers(value: unknown) {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const positiveInteger = (candidate: unknown, fallback: number) => {
    const parsed = Math.floor(Number(candidate));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  };
  return {
    DAY: Number.isFinite(Number(source.DAY)) && Number(source.DAY) > 0 ? Number(source.DAY) : DEFAULT_DURATION_MULTIPLIERS.DAY,
    MONTH: Number.isFinite(Number(source.MONTH)) && Number(source.MONTH) > 0 ? Number(source.MONTH) : DEFAULT_DURATION_MULTIPLIERS.MONTH,
    YEAR: Number.isFinite(Number(source.YEAR)) && Number(source.YEAR) > 0 ? Number(source.YEAR) : DEFAULT_DURATION_MULTIPLIERS.YEAR,
    quantityOperation: parseOperation(source.quantityOperation),
    durationOperation: parseOperation(source.durationOperation),
    baseAmountLabel: cleanText(source.baseAmountLabel, 60) || "Base amount",
    quantityLabel: cleanText(source.quantityLabel, 60) || "Quantity",
    durationLabel: cleanText(source.durationLabel, 60) || "Duration",
    durationUnitLabel: cleanText(source.durationUnitLabel, 60) || "Duration unit",
    quantityMin: positiveInteger(source.quantityMin, 1),
    durationMin: positiveInteger(source.durationMin, 1),
    quantityStep: positiveInteger(source.quantityStep, 1),
    durationStep: positiveInteger(source.durationStep, 1),
  };
}

function parseSettingsJson(value: unknown) {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const pricing = parseMultipliers(source);
  const webhook = source.webhook && typeof source.webhook === "object" ? source.webhook as Record<string, unknown> : {};
  return {
    ...pricing,
    closerCanApprovePayment: source.closerCanApprovePayment === true,
    confirmationWebhookEnabled: webhook.enabled === true,
    confirmationWebhookUrl: cleanText(webhook.url, 2048) || null,
    confirmationWebhookSecret: cleanText(webhook.secret, 256) || null,
  };
}

function settingsJson(input: { durationMultipliers?: unknown; closerCanApprovePayment?: boolean; confirmationWebhookEnabled?: boolean; confirmationWebhookUrl?: string | null; confirmationWebhookSecret?: string | null }, existing?: unknown) {
  const base = parseMultipliers(input.durationMultipliers ?? existing);
  const previous = parseSettingsJson(existing);
  return {
    ...base,
    closerCanApprovePayment: Boolean(input.closerCanApprovePayment ?? previous.closerCanApprovePayment),
    webhook: {
      enabled: Boolean(input.confirmationWebhookEnabled ?? previous.confirmationWebhookEnabled),
      url: cleanText(input.confirmationWebhookUrl ?? previous.confirmationWebhookUrl, 2048) || null,
      secret: input.confirmationWebhookSecret ? cleanText(input.confirmationWebhookSecret, 256) : previous.confirmationWebhookSecret,
    },
  };
}

function applyPricingOperation(base: Prisma.Decimal, operand: Prisma.Decimal, operation: PricingOperation) {
  if (operation === "ADD") return base.add(operand);
  if (operation === "SUBTRACT") return base.sub(operand);
  if (operation === "DIVIDE") {
    if (operand.lessThanOrEqualTo(0)) throw new Error("Divide operation needs a positive value.");
    return base.div(operand);
  }
  return base.mul(operand);
}

function buildUpiUri(input: { upiId: string; payeeName: string; amount: number; note: string; reference: string }) {
  const params = new URLSearchParams({
    pa: input.upiId,
    pn: input.payeeName,
    am: input.amount.toFixed(2),
    cu: "INR",
    tn: input.note,
    tr: input.reference,
  });
  return `upi://pay?${params.toString()}`;
}

function eventData(tenantId: string, paymentLinkId: string, actorUserId: string | null, actorRole: string, action: string, note?: string) {
  return { tenantId, paymentLinkId, actorUserId, actorRole, action, note: note || null };
}

export async function getUpiSettings(tenantId: string) {
  const settings = await prisma.upiPaymentSetting.upsert({
    where: { tenantId },
    update: {},
    create: {
      tenantId,
      durationMultipliers: DEFAULT_DURATION_MULTIPLIERS,
    },
  });
  const policies = await prisma.upiPaymentFieldPolicy.findMany({ where: { tenantId }, orderBy: [{ surface: "asc" }, { sortOrder: "asc" }] });
  if (policies.length === 0) {
    await prisma.upiPaymentFieldPolicy.createMany({
      data: DEFAULT_UPI_FIELDS.map((field) => ({ tenantId, ...field })),
      skipDuplicates: true,
    });
  }
  const finalPolicies = policies.length > 0 ? policies : await prisma.upiPaymentFieldPolicy.findMany({ where: { tenantId }, orderBy: [{ surface: "asc" }, { sortOrder: "asc" }] });
  return { settings: { ...settings, ...parseSettingsJson(settings.durationMultipliers) }, policies: finalPolicies };
}

export async function saveUpiSettings(input: {
  tenantId: string;
  userId: string;
  enabled?: boolean;
  upiId?: string | null;
  payeeName?: string | null;
  instructions?: string | null;
  qrBrandName?: string | null;
  qrAccentColor?: string | null;
  qrLogoDataUrl?: string | null;
  screenshotRequired?: boolean;
  utrEnabled?: boolean;
  autoActivateOnApproval?: boolean;
  closerCanApprovePayment?: boolean;
  confirmationWebhookEnabled?: boolean;
  confirmationWebhookUrl?: string | null;
  confirmationWebhookSecret?: string | null;
  durationMultipliers?: unknown;
}) {
  const upiId = cleanText(input.upiId, 120);
  const payeeName = cleanText(input.payeeName, 120);
  if (input.enabled && (!upiId || !payeeName)) throw new Error("UPI ID and payee name are required when payment collection is enabled.");
  const accent = cleanText(input.qrAccentColor, 20);
  if (accent && !/^#[0-9a-f]{6}$/i.test(accent)) throw new Error("QR accent color must be a valid hex color.");
  const logo = cleanText(input.qrLogoDataUrl, 280_000);
  if (logo && !/^data:image\/(png|jpeg|jpg|webp);base64,/i.test(logo)) throw new Error("QR logo must be a PNG, JPG, or WebP image.");
  const webhookUrl = cleanText(input.confirmationWebhookUrl, 2048);
  if (input.confirmationWebhookEnabled && !webhookUrl) throw new Error("Webhook URL is required when confirmation webhook is enabled.");
  if (input.confirmationWebhookEnabled && webhookUrl) {
    try {
      const parsed = new URL(webhookUrl);
      if (!(parsed.protocol === "https:" || parsed.protocol === "http:")) throw new Error();
    } catch {
      throw new Error("Webhook URL must be a valid HTTP or HTTPS URL.");
    }
  }
  const webhookSecret = input.confirmationWebhookSecret === undefined
    ? undefined
    : cleanText(input.confirmationWebhookSecret, 256);
  const existing = await prisma.upiPaymentSetting.findUnique({ where: { tenantId: input.tenantId }, select: { durationMultipliers: true } });
  const jsonSettings = settingsJson({ ...input, confirmationWebhookUrl: webhookUrl, confirmationWebhookSecret: webhookSecret }, existing?.durationMultipliers);
  return prisma.upiPaymentSetting.upsert({
    where: { tenantId: input.tenantId },
    update: {
      enabled: Boolean(input.enabled), upiId: upiId || null, payeeName: payeeName || null,
      instructions: cleanText(input.instructions, 1000) || null, qrBrandName: cleanText(input.qrBrandName, 100) || null,
      qrAccentColor: accent || "#ff5a1f", qrLogoDataUrl: logo || null, screenshotRequired: input.screenshotRequired !== false,
      utrEnabled: input.utrEnabled !== false, autoActivateOnApproval: Boolean(input.autoActivateOnApproval),
      durationMultipliers: jsonSettings, updatedByUserId: input.userId,
    },
    create: {
      tenantId: input.tenantId, enabled: Boolean(input.enabled), upiId: upiId || null, payeeName: payeeName || null,
      instructions: cleanText(input.instructions, 1000) || null, qrBrandName: cleanText(input.qrBrandName, 100) || null,
      qrAccentColor: accent || "#ff5a1f", qrLogoDataUrl: logo || null, screenshotRequired: input.screenshotRequired !== false,
      utrEnabled: input.utrEnabled !== false, autoActivateOnApproval: Boolean(input.autoActivateOnApproval),
      durationMultipliers: jsonSettings, createdByUserId: input.userId, updatedByUserId: input.userId,
    },
  });
}

export async function saveUpiFieldPolicies(input: { tenantId: string; policies: Array<Record<string, unknown>> }) {
  const allowedSurfaces = new Set(["CLOSER", "CUSTOMER"]);
  return prisma.$transaction(async (tx) => {
    for (const raw of input.policies.slice(0, 50)) {
      const fieldKey = cleanText(raw.fieldKey, 80);
      if (!fieldKey) continue;
      await tx.upiPaymentFieldPolicy.upsert({
        where: { tenantId_fieldKey: { tenantId: input.tenantId, fieldKey } },
        update: {
          label: cleanText(raw.label, 100) || fieldKey, visible: raw.visible !== false, required: Boolean(raw.required),
          surface: allowedSurfaces.has(String(raw.surface).toUpperCase()) ? String(raw.surface).toUpperCase() : "CLOSER",
          reportVisible: raw.reportVisible !== false, sortOrder: Math.max(0, Math.min(9999, Number(raw.sortOrder) || 100)),
        },
        create: {
          tenantId: input.tenantId, fieldKey, label: cleanText(raw.label, 100) || fieldKey, visible: raw.visible !== false, required: Boolean(raw.required),
          surface: allowedSurfaces.has(String(raw.surface).toUpperCase()) ? String(raw.surface).toUpperCase() : "CLOSER",
          reportVisible: raw.reportVisible !== false, sortOrder: Math.max(0, Math.min(9999, Number(raw.sortOrder) || 100)),
        },
      });
    }
    return tx.upiPaymentFieldPolicy.findMany({ where: { tenantId: input.tenantId }, orderBy: [{ surface: "asc" }, { sortOrder: "asc" }] });
  });
}

function serializeLink(link: any) {
  return {
    id: link.id, publicToken: link.publicToken, status: link.status, tenantId: link.tenantId,
    createdByUserId: link.createdByUserId, createdByName: link.createdBy?.displayName || "Unknown",
    customerUserId: link.customerUserId, customerName: link.customerName, customerPhone: link.customerPhone,
    customerEmail: link.customerEmail, productName: link.productName, packageId: link.packageId,
    baseAmount: asNumber(link.baseAmount), quantity: link.quantity, duration: link.duration, durationUnit: link.durationUnit,
    durationMultiplier: asNumber(link.durationMultiplier), totalAmount: asNumber(link.totalAmount), currency: link.currency,
    upiId: link.upiIdSnapshot, payeeName: link.payeeNameSnapshot, customerNote: link.customerNote,
    utrReference: link.utrReference, hasProof: Boolean(link.proofStoragePath), confirmedByName: link.confirmedBy?.displayName || null,
    confirmedAt: link.confirmedAt?.toISOString() || null, confirmationNote: link.confirmationNote || null, approvedByName: link.approvedBy?.displayName || null,
    approvedAt: link.approvedAt?.toISOString() || null, rejectedAt: link.rejectedAt?.toISOString() || null,
    rejectionReason: link.rejectionReason, paidAt: link.paidAt?.toISOString() || null, activatedAt: link.activatedAt?.toISOString() || null, expiresAt: linkExpiresAt(link)?.toISOString() || null, createdAt: link.createdAt.toISOString(),
    updatedAt: link.updatedAt.toISOString(), customFields: Object.fromEntries(Object.entries((link.customFields || {}) as Record<string, unknown>).filter(([key]) => key !== LINK_EXPIRY_KEY)),
  };
}

const linkInclude = {
  createdBy: { select: { displayName: true, email: true, phone: true } },
  confirmedBy: { select: { displayName: true } },
  approvedBy: { select: { displayName: true } },
  rejectedBy: { select: { displayName: true } },
} as const;

export async function listUpiPaymentLinks(input: { tenantId?: string; userId?: string; role: AppRole; limit?: number }) {
  const where: Record<string, unknown> = {};
  if (!(input.role === "ADMIN" || input.role === "MANAGER" || input.role === "SALES_AGENT") || !input.tenantId) throw new Error("A tenant workspace is required to access payment links.");
  where.tenantId = input.tenantId;
  if (input.role === "SALES_AGENT") where.createdByUserId = input.userId;
  const rows = await prisma.upiPaymentLink.findMany({ where, include: linkInclude, orderBy: { createdAt: "desc" }, take: Math.min(200, Math.max(1, input.limit || 100)) });
  const settings = await prisma.upiPaymentSetting.findUnique({ where: { tenantId: input.tenantId }, select: { durationMultipliers: true, upiId: true, payeeName: true, qrAccentColor: true, qrBrandName: true } });
  const canApprove = input.role === "ADMIN" || (input.role === "SALES_AGENT" && parseSettingsJson(settings?.durationMultipliers).closerCanApprovePayment);
  const stats = {
    total: rows.length,
    pending: rows.filter((row) => row.status === "PENDING").length,
    customerConfirmed: rows.filter((row) => row.status === "CUSTOMER_CONFIRMED").length,
    paid: rows.filter((row) => row.status === "PAID").length,
    revenue: rows.filter((row) => row.status === "PAID").reduce((sum, row) => sum + asNumber(row.totalAmount), 0),
  };
  return { rows: rows.map(serializeLink), stats, canApprove, preview: { upiId: settings?.upiId || "", payeeName: settings?.payeeName || "", qrAccentColor: settings?.qrAccentColor || "#ff5a1f", qrBrandName: settings?.qrBrandName || settings?.payeeName || "UPI payment" } };
}

export async function listUpiPackages() {
  return prisma.package.findMany({
    where: { isActive: true, packageType: { in: ["AGENCY", "BOTH"] } },
    select: { id: true, name: true, amount: true, durationDays: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    take: 100,
  });
}

export async function createUpiPaymentLink(input: {
  tenantId: string; createdByUserId: string; baseAmount: unknown; quantity: unknown; duration: unknown;
  durationUnit: string; customerUserId?: string | null; customerName?: unknown; customerPhone?: unknown; customerEmail?: unknown;
  productName?: unknown; packageId?: unknown; customerNote?: unknown; customFields?: unknown; validityValue?: unknown; validityUnit?: unknown;
}) {
  const { settings, policies } = await getUpiSettings(input.tenantId);
  if (!settings.enabled || !settings.upiId || !settings.payeeName) throw new Error("UPI payment collection is not enabled for this workspace.");
  const unit = String(input.durationUnit || "MONTH").toUpperCase();
  if (!(unit === "DAY" || unit === "MONTH" || unit === "YEAR")) throw new Error("Choose a valid duration unit.");
  const baseAmount = cleanPositiveNumber(input.baseAmount, "Base amount");
  const quantity = Math.floor(cleanPositiveNumber(input.quantity, "Quantity"));
  const duration = Math.floor(cleanPositiveNumber(input.duration, "Duration"));
  const validity = parseLinkValidity(input.validityValue ?? 1, input.validityUnit ?? "DAY");
  const pricing = parseMultipliers(settings.durationMultipliers);
  if (quantity < pricing.quantityMin) throw new Error(`${pricing.quantityLabel} must be at least ${pricing.quantityMin}.`);
  if (duration < pricing.durationMin) throw new Error(`${pricing.durationLabel} must be at least ${pricing.durationMin}.`);
  if (quantity > 100000 || duration > 10000) throw new Error("Quantity or duration is too large.");
  const multiplier = pricing[unit as "DAY" | "MONTH" | "YEAR"];
  const durationOperand = new Prisma.Decimal(duration).mul(multiplier);
  const totalAmount = applyPricingOperation(
    applyPricingOperation(new Prisma.Decimal(baseAmount), new Prisma.Decimal(quantity), pricing.quantityOperation),
    durationOperand,
    pricing.durationOperation,
  ).toDecimalPlaces(2);
  const customerName = cleanText(input.customerName, 160) || null;
  const customerPhone = cleanText(input.customerPhone, 40) || null;
  const customerEmail = cleanText(input.customerEmail, 160) || null;
  const productName = cleanText(input.productName, 160) || null;
  const customerNote = cleanText(input.customerNote, 1000) || null;
  for (const field of policies.filter((item) => item.surface === "CLOSER" && item.visible && item.required)) {
    const values: Record<string, string | null> = { customerName, customerPhone, customerEmail, productName, customerNote };
    if (!values[field.fieldKey] && !((input.customFields as Record<string, unknown> | undefined)?.[field.fieldKey])) throw new Error(`${field.label} is required.`);
  }
  const visibleKeys = new Set(policies.filter((field) => field.surface === "CLOSER" && field.visible).map((field) => field.fieldKey));
  const rawCustom = input.customFields && typeof input.customFields === "object" ? input.customFields as Record<string, unknown> : {};
  const customFields = { ...Object.fromEntries(Object.entries(rawCustom).filter(([key]) => visibleKeys.has(key)).map(([key, value]) => [key, cleanText(value, 1000)])), [LINK_EXPIRY_KEY]: { expiresAt: validity.expiresAt.toISOString(), value: validity.value, unit: validity.unit } };
  let customerUser = null;
  if (input.customerUserId) {
    customerUser = await prisma.appAuthUser.findFirst({ where: { id: cleanText(input.customerUserId, 100), tenantId: input.tenantId }, select: { id: true, displayName: true, email: true, phone: true } });
  }
  const publicToken = randomBytes(24).toString("base64url");
  const created = await prisma.$transaction(async (tx) => {
    const link = await tx.upiPaymentLink.create({
      data: {
        tenantId: input.tenantId, publicToken, createdByUserId: input.createdByUserId, customerUserId: customerUser?.id || null,
        baseAmount: new Prisma.Decimal(baseAmount), quantity, duration, durationUnit: unit as "DAY" | "MONTH" | "YEAR",
        durationMultiplier: new Prisma.Decimal(multiplier), totalAmount, upiIdSnapshot: settings.upiId!, payeeNameSnapshot: settings.payeeName!,
        instructionsSnapshot: settings.instructions, customerName: customerName || customerUser?.displayName || null,
        customerPhone: customerPhone || customerUser?.phone || null, customerEmail: customerEmail || customerUser?.email || null,
        productName, packageId: cleanText(input.packageId, 100) || null, customFields, customerNote,
      }, include: linkInclude,
    });
    await tx.upiPaymentEvent.create({ data: eventData(input.tenantId, link.id, input.createdByUserId, "CREATOR", "LINK_CREATED", "Payment link generated.") });
    return link;
  });
  return serializeLink(created);
}

export async function getPublicUpiPaymentLink(token: string) {
  const link = await prisma.upiPaymentLink.findUnique({ where: { publicToken: token }, include: linkInclude });
  if (!link || link.status === "CANCELLED") return null;
  const expiresAt = linkExpiresAt(link);
  const expired = Boolean(expiresAt && expiresAt.getTime() <= Date.now());
  if (expired && !["PAID", "REJECTED", "EXPIRED"].includes(link.status)) {
    await prisma.upiPaymentLink.updateMany({ where: { id: link.id, status: { in: ["PENDING", "CUSTOMER_CONFIRMED"] } }, data: { status: "EXPIRED" } });
  }
  const amount = asNumber(link.totalAmount);
  const upiUri = buildUpiUri({ upiId: link.upiIdSnapshot, payeeName: link.payeeNameSnapshot, amount, note: link.productName || "Payment", reference: `AI-${link.id.slice(-12)}` });
  const settings = await prisma.upiPaymentSetting.findUnique({ where: { tenantId: link.tenantId }, select: { screenshotRequired: true, utrEnabled: true, qrBrandName: true, qrAccentColor: true, qrLogoDataUrl: true } });
  return {
    publicToken: link.publicToken, status: expired ? "EXPIRED" : link.status, totalAmount: amount, quantity: link.quantity, duration: link.duration,
    durationUnit: link.durationUnit, productName: link.productName, customerName: link.customerName, customerPhone: link.customerPhone,
    customerEmail: link.customerEmail, payeeName: link.payeeNameSnapshot, upiId: link.upiIdSnapshot,
    upiUri, qrDataUrl: await QRCode.toDataURL(upiUri, { width: 360, margin: 2, errorCorrectionLevel: "H" }),
    instructions: (link as any).instructionsSnapshot || null, screenshotRequired: settings?.screenshotRequired !== false,
    utrEnabled: settings?.utrEnabled !== false, qrBrandName: settings?.qrBrandName || link.payeeNameSnapshot,
    qrAccentColor: settings?.qrAccentColor || "#ff5a1f", qrLogoDataUrl: settings?.qrLogoDataUrl || null, expiresAt: expiresAt?.toISOString() || null,
  };
}

const PROOF_ROOT = path.join(process.cwd(), "data", "uploads", "upi-payment-proofs");
function safeProofPath(relativePath: string) {
  const resolved = path.resolve(PROOF_ROOT, relativePath);
  if (!resolved.startsWith(`${path.resolve(PROOF_ROOT)}${path.sep}`)) throw new Error("Invalid proof path.");
  return resolved;
}

export async function confirmPublicUpiPayment(input: {
  token: string; sessionUserId?: string | null; customerName?: unknown; customerPhone?: unknown; customerEmail?: unknown;
  utrReference?: unknown; confirmationNote?: unknown; proof?: File | null;
}) {
  const link = await prisma.upiPaymentLink.findUnique({ where: { publicToken: input.token } });
  if (!link) throw new Error("Payment link not found.");
  if (link.status === "CUSTOMER_CONFIRMED" || link.status === "PAID") return serializeLink(await prisma.upiPaymentLink.findUniqueOrThrow({ where: { id: link.id }, include: linkInclude }));
  const expiresAt = linkExpiresAt(link);
  if (expiresAt && expiresAt <= new Date()) {
    await prisma.upiPaymentLink.updateMany({ where: { id: link.id, status: { in: ["PENDING", "CUSTOMER_CONFIRMED"] } }, data: { status: "EXPIRED" } });
    throw new Error("This payment link has expired.");
  }
  if (link.status !== "PENDING") throw new Error("This payment link is no longer accepting confirmations.");
  const settings = await prisma.upiPaymentSetting.findUnique({ where: { tenantId: link.tenantId }, select: { screenshotRequired: true, utrEnabled: true } });
  const proof = input.proof && input.proof.size > 0 ? input.proof : null;
  if (settings?.screenshotRequired !== false && !proof) throw new Error("Payment screenshot is required.");
  if (proof) {
    if (proof.size > 5 * 1024 * 1024) throw new Error("Payment screenshot must be 5 MB or smaller.");
    if (!/^image\/(png|jpeg|webp)$/i.test(proof.type)) throw new Error("Only PNG, JPG, or WebP screenshots are supported.");
  }
  const proofPath = proof ? `${link.tenantId}/${link.id}-${randomBytes(8).toString("hex")}.${proof.type.split("/")[1] === "jpeg" ? "jpg" : proof.type.split("/")[1]}` : null;
  if (proof && proofPath) {
    const storagePath = safeProofPath(proofPath);
    await mkdir(path.dirname(storagePath), { recursive: true });
    await writeFile(storagePath, Buffer.from(await proof.arrayBuffer()));
  }
  const customerName = cleanText(input.customerName, 160) || link.customerName;
  const customerPhone = cleanText(input.customerPhone, 40) || link.customerPhone;
  const customerEmail = cleanText(input.customerEmail, 160) || link.customerEmail;
  let confirmedUserId = link.customerUserId;
  if (input.sessionUserId) {
    const customerUser = await prisma.appAuthUser.findFirst({ where: { id: input.sessionUserId, tenantId: link.tenantId }, select: { id: true } });
    if (customerUser) confirmedUserId = customerUser.id;
  }
  const updated = await prisma.$transaction(async (tx) => {
    const current = await tx.upiPaymentLink.findUnique({ where: { id: link.id } });
    if (!current || current.status !== "PENDING") return current;
    const saved = await tx.upiPaymentLink.update({ where: { id: link.id }, data: {
      status: "CUSTOMER_CONFIRMED", customerUserId: confirmedUserId || null,
      customerName, customerPhone, customerEmail, utrReference: settings?.utrEnabled === false ? null : cleanText(input.utrReference, 120) || null,
      confirmationNote: cleanText(input.confirmationNote, 1000) || null, proofStoragePath: proofPath, proofMimeType: proof?.type || null,
      proofSizeBytes: proof?.size || null, confirmedByUserId: input.sessionUserId || null, confirmedAt: new Date(),
    }, include: linkInclude });
    await tx.upiPaymentEvent.create({ data: eventData(current.tenantId, current.id, input.sessionUserId || null, input.sessionUserId ? "CUSTOMER" : "GUEST", "CUSTOMER_CONFIRMED", "Customer submitted payment proof.") });
    return saved;
  });
  return updated ? serializeLink(updated) : null;
}

export async function attachUpiPaymentProof(input: { id: string; tenantId: string; actorUserId: string; actorRole: string; proof: File }) {
  const link = await prisma.upiPaymentLink.findFirst({ where: { id: input.id, tenantId: input.tenantId } });
  if (!link) throw new Error("Payment link not found.");
  if (input.actorRole === "SALES_AGENT") {
    if (link.createdByUserId !== input.actorUserId) throw new Error("You can only attach proof to your own payment links.");
  }
  if (!["PENDING", "CUSTOMER_CONFIRMED"].includes(link.status)) throw new Error("This payment link is no longer awaiting proof.");
  if (input.proof.size <= 0) throw new Error("Please choose a payment screenshot.");
  if (input.proof.size > 5 * 1024 * 1024) throw new Error("Payment screenshot must be 5 MB or smaller.");
  if (!/^image\/(png|jpeg|webp)$/i.test(input.proof.type)) throw new Error("Only PNG, JPG, or WebP screenshots are supported.");
  const proofPath = `${link.tenantId}/${link.id}-${randomBytes(8).toString("hex")}.${input.proof.type.split("/")[1] === "jpeg" ? "jpg" : input.proof.type.split("/")[1]}`;
  const storagePath = safeProofPath(proofPath);
  await mkdir(path.dirname(storagePath), { recursive: true });
  await writeFile(storagePath, Buffer.from(await input.proof.arrayBuffer()));
  const saved = await prisma.$transaction(async (tx) => {
    const current = await tx.upiPaymentLink.findFirst({ where: { id: input.id, tenantId: input.tenantId } });
    if (!current || !["PENDING", "CUSTOMER_CONFIRMED"].includes(current.status)) throw new Error("This payment link is no longer awaiting proof.");
    const updated = await tx.upiPaymentLink.update({ where: { id: current.id }, data: { proofStoragePath: proofPath, proofMimeType: input.proof.type, proofSizeBytes: input.proof.size }, include: linkInclude });
    await tx.upiPaymentEvent.create({ data: eventData(current.tenantId, current.id, input.actorUserId, input.actorRole, "PROOF_ATTACHED", "Payment proof attached by tenant admin.") });
    return updated;
  });
  return serializeLink(saved);
}

export async function approveUpiPaymentLink(input: { id: string; tenantId: string; actorUserId: string; actorRole: string }) {
  const result = await prisma.$transaction(async (tx) => {
    const link = await tx.upiPaymentLink.findFirst({ where: { id: input.id, tenantId: input.tenantId } });
    if (!link || !["PENDING", "CUSTOMER_CONFIRMED"].includes(link.status)) throw new Error("Only pending payment links can be approved.");
    const expiresAt = linkExpiresAt(link);
    if (expiresAt && expiresAt <= new Date()) throw new Error("This payment link has expired.");
    const settings = await tx.upiPaymentSetting.findUnique({ where: { tenantId: link.tenantId } });
    if (input.actorRole === "SALES_AGENT" && (link.createdByUserId !== input.actorUserId || !parseSettingsJson(settings?.durationMultipliers).closerCanApprovePayment)) throw new Error("Closer approval is not enabled for this workspace.");
    const webhookSettings = parseSettingsJson(settings?.durationMultipliers);
    let activatedAt: Date | null = null;
    let activationUserId = link.customerUserId;
    if (!activationUserId && link.customerEmail) {
      const matchedUser = await tx.appAuthUser.findFirst({ where: { tenantId: link.tenantId, email: link.customerEmail }, select: { id: true } });
      activationUserId = matchedUser?.id || null;
    }
    if (!activationUserId && link.customerPhone) {
      const matchedUser = await tx.appAuthUser.findFirst({ where: { tenantId: link.tenantId, phone: link.customerPhone }, select: { id: true } });
      activationUserId = matchedUser?.id || null;
    }
    if (settings?.autoActivateOnApproval && activationUserId && link.packageId) {
      const packageRecord = await tx.package.findUnique({ where: { id: link.packageId } });
      if (packageRecord) {
        const expiresAt = new Date(Date.now() + packageRecord.durationDays * 86_400_000);
        await tx.appAuthUser.update({ where: { id: activationUserId }, data: { packageId: packageRecord.id, packageName: packageRecord.name, packageStatus: "ACTIVE", packageExpiresAt: expiresAt } });
        const subscription = await tx.userSubscription.findFirst({ where: { userId: activationUserId, packageId: packageRecord.id }, orderBy: { createdAt: "desc" } });
        if (subscription) await tx.userSubscription.update({ where: { id: subscription.id }, data: { status: "ACTIVE", paymentStatus: "PAID", startsAt: new Date(), expiresAt } });
        else await tx.userSubscription.create({ data: { userId: activationUserId, packageId: packageRecord.id, packageType: packageRecord.packageType, provider: "UPI_MANUAL", billingType: packageRecord.billingType, billingInterval: packageRecord.billingInterval, status: "ACTIVE", paymentStatus: "PAID", amount: link.totalAmount, startsAt: new Date(), expiresAt } });
        activatedAt = new Date();
      }
    }
    const saved = await tx.upiPaymentLink.update({ where: { id: link.id }, data: { status: "PAID", customerUserId: activationUserId, approvedByUserId: input.actorUserId, approvedAt: new Date(), paidAt: new Date(), activatedAt }, include: linkInclude });
    await tx.upiPaymentEvent.create({ data: eventData(link.tenantId, link.id, input.actorUserId, input.actorRole, "APPROVED", activatedAt ? "Payment approved and package activated." : "Payment approved.") });
    return {
      paymentLink: saved,
      webhook: webhookSettings.confirmationWebhookEnabled && webhookSettings.confirmationWebhookUrl
        ? { url: webhookSettings.confirmationWebhookUrl, secret: webhookSettings.confirmationWebhookSecret || "" }
        : null,
    };
  });
  const serialized = serializeLink(result.paymentLink);
  const webhook = await sendUpiPaymentApprovalWebhook({
    paymentLink: serialized,
    webhook: result.webhook,
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
    event: "payment.approved",
  });
  return { ...serialized, webhook };
}

export async function sendUpiPaymentApprovalWebhook(input: {
  paymentLink: ReturnType<typeof serializeLink>;
  webhook: { url: string; secret: string } | null;
  tenantId: string;
  actorUserId: string;
  event?: "payment.approved" | "payment.confirmation.resend";
}) {
  if (!input.webhook?.url) return { attempted: false as const, delivered: false as const, reason: "Webhook is disabled." };
  const payload = {
    event: input.event || "payment.approved",
    version: "1",
    sentAt: new Date().toISOString(),
    tenantId: input.tenantId,
    payment: {
      id: input.paymentLink.id,
      publicToken: input.paymentLink.publicToken,
      status: input.paymentLink.status,
      amount: input.paymentLink.totalAmount,
      currency: input.paymentLink.currency,
      baseAmount: input.paymentLink.baseAmount,
      quantity: input.paymentLink.quantity,
      duration: input.paymentLink.duration,
      durationUnit: input.paymentLink.durationUnit,
      productName: input.paymentLink.productName,
      packageId: input.paymentLink.packageId,
      upiId: input.paymentLink.upiId,
      payeeName: input.paymentLink.payeeName,
      utrReference: input.paymentLink.utrReference,
      customer: {
        userId: input.paymentLink.customerUserId,
        name: input.paymentLink.customerName,
        phone: input.paymentLink.customerPhone,
        email: input.paymentLink.customerEmail,
      },
      confirmation: {
        confirmedByName: input.paymentLink.confirmedByName,
        confirmedAt: input.paymentLink.confirmedAt,
        note: (input.paymentLink as { confirmationNote?: string | null }).confirmationNote ?? null,
        hasProof: input.paymentLink.hasProof,
      },
      approval: {
        approvedByName: input.paymentLink.approvedByName,
        approvedAt: input.paymentLink.approvedAt,
        paidAt: input.paymentLink.paidAt,
        activatedAt: input.paymentLink.activatedAt ?? null,
      },
      attribution: {
        createdByUserId: input.paymentLink.createdByUserId,
        createdByName: input.paymentLink.createdByName,
        createdAt: input.paymentLink.createdAt,
      },
      customFields: input.paymentLink.customFields,
    },
  };
  const body = JSON.stringify(payload);
  const signature = input.webhook.secret ? `sha256=${createHmac("sha256", input.webhook.secret).update(body).digest("hex")}` : "";
  try {
    const response = await fetch(input.webhook.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": "AIcloser-Payments/1.0",
        "x-aicloser-event": payload.event,
        "x-aicloser-delivery-id": input.paymentLink.id,
        ...(signature ? { "x-aicloser-signature": signature } : {}),
      },
      body,
      signal: AbortSignal.timeout(8000),
    });
    const responseText = (await response.text().catch(() => "")).slice(0, 500);
    const delivery = { attempted: true as const, delivered: response.ok, status: response.status, response: responseText || null };
    await prisma.upiPaymentEvent.create({ data: eventData(input.tenantId, input.paymentLink.id, input.actorUserId, "ADMIN", response.ok ? "CONFIRMATION_WEBHOOK_DELIVERED" : "CONFIRMATION_WEBHOOK_FAILED", `Webhook response ${response.status}.`) });
    return delivery;
  } catch (error) {
    await prisma.upiPaymentEvent.create({ data: eventData(input.tenantId, input.paymentLink.id, input.actorUserId, "ADMIN", "CONFIRMATION_WEBHOOK_FAILED", error instanceof Error ? error.message.slice(0, 500) : "Webhook request failed.") });
    return { attempted: true as const, delivered: false as const, error: "Webhook request failed." };
  }
}

export async function resendUpiPaymentApprovalWebhook(input: { id: string; tenantId: string; actorUserId: string }) {
  const link = await prisma.upiPaymentLink.findFirst({ where: { id: input.id, tenantId: input.tenantId }, include: linkInclude });
  if (!link) throw new Error("Payment link not found.");
  if (link.status !== "PAID") throw new Error("Only approved payments can send an order confirmation.");
  const settings = await prisma.upiPaymentSetting.findUnique({ where: { tenantId: input.tenantId } });
  const webhookSettings = parseSettingsJson(settings?.durationMultipliers);
  const webhook = webhookSettings.confirmationWebhookEnabled && webhookSettings.confirmationWebhookUrl
    ? { url: webhookSettings.confirmationWebhookUrl, secret: webhookSettings.confirmationWebhookSecret || "" }
    : null;
  return sendUpiPaymentApprovalWebhook({ paymentLink: serializeLink(link), webhook, tenantId: input.tenantId, actorUserId: input.actorUserId, event: "payment.confirmation.resend" });
}

export async function rejectUpiPaymentLink(input: { id: string; tenantId: string; actorUserId: string; actorRole: string; reason?: string }) {
  return prisma.$transaction(async (tx) => {
    const link = await tx.upiPaymentLink.findFirst({ where: { id: input.id, tenantId: input.tenantId } });
    if (!link || ["PAID", "CANCELLED"].includes(link.status)) throw new Error("This payment link cannot be rejected.");
    const saved = await tx.upiPaymentLink.update({ where: { id: link.id }, data: { status: "REJECTED", rejectedByUserId: input.actorUserId, rejectedAt: new Date(), rejectionReason: cleanText(input.reason, 500) || "Payment proof was rejected." }, include: linkInclude });
    await tx.upiPaymentEvent.create({ data: eventData(link.tenantId, link.id, input.actorUserId, input.actorRole, "REJECTED", saved.rejectionReason || undefined) });
    return serializeLink(saved);
  });
}

export async function readUpiProof(id: string, tenantId?: string, role?: AppRole, userId?: string) {
  const link = await prisma.upiPaymentLink.findUnique({ where: { id }, select: { tenantId: true, createdByUserId: true, proofStoragePath: true, proofMimeType: true } });
  if (role !== "SUPER_ADMIN" && tenantId && link?.tenantId !== tenantId) return null;
  if (role === "SALES_AGENT" && link?.createdByUserId !== userId) return null;
  if (!link?.proofStoragePath) return null;
  return { bytes: await readFile(safeProofPath(link.proofStoragePath)), mimeType: link.proofMimeType || "application/octet-stream" };
}
