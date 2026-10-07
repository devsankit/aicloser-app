import "server-only";

import type { DummyWhatsAppConnectionState } from "@/lib/gigxomi/dummy-platform-store";
import { prisma } from "@/lib/prisma";

const MANUAL_OVERRIDE_KEYS = [
  "phoneNumber",
  "phoneNumberId",
  "wabaId",
  "businessPortfolioId",
  "businessId",
  "displayName",
  "businessName",
  "systemUserId",
] as const;

/**
 * Returns the persisted WhatsApp channel for the current workspace.
 *
 * The sales dashboard used to create a file-backed "draft" connection when
 * no channel existed. That made a fresh workspace look configured even
 * though the database had no real channel. Keep the dashboard honest: return
 * null until a channel has actually been connected and persisted.
 */
export async function getSalesWhatsAppChannelView(tenantId: string): Promise<DummyWhatsAppConnectionState | null> {
  const normalizedTenantId = tenantId.trim();
  if (!normalizedTenantId) return null;

  const channel = await prisma.whatsAppChannel.findFirst({
    where: { tenantId: normalizedTenantId },
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
  });

  if (!channel) return null;

  const manualOverrides = Object.fromEntries(MANUAL_OVERRIDE_KEYS.map((key) => [key, false])) as DummyWhatsAppConnectionState["manualOverrides"];
  const connected = channel.status === "ACTIVE";
  const updatedAt = channel.updatedAt.toISOString();

  return {
    tenantId: channel.tenantId,
    businessName: channel.verifiedName ?? "",
    displayName: channel.verifiedName ?? channel.displayPhoneNumber,
    phoneNumber: channel.displayPhoneNumber,
    manualOverrides,
    pluginEnabled: connected,
    paymentsEnabled: false,
    paymentsGateway: "razorpay",
    paymentsConfigurationName: "",
    paymentsTemplateName: "",
    subscriptionPaymentTemplateName: "",
    subscriptionPaymentTemplateLanguage: "en_US",
    renewalReminderTemplateName: "",
    renewalReminderTemplateLanguage: "en_US",
    otpTemplateName: "",
    otpTemplateLanguage: "en_US",
    status: connected ? "Number connected" : "Not started",
    note: connected ? "Persisted WhatsApp channel" : "WhatsApp channel requires attention",
    metaAppId: "",
    metaConfigId: "",
    sessionInfoVersion: "",
    embeddedSignupVersion: "",
    verifyToken: channel.webhookVerifyToken ?? "",
    publicBaseUrl: "",
    graphApiVersion: channel.graphApiVersion,
    businessId: channel.businessId ?? "",
    businessPortfolioId: channel.businessPortfolioId ?? "",
    wabaId: channel.wabaId,
    phoneNumberId: channel.phoneNumberId,
    systemUserId: "",
    authorizationCode: "",
    accessToken: "",
    lastLaunchAt: channel.lastSyncedAt?.toISOString(),
    lastInboundAt: undefined,
    lastOutboundAt: undefined,
    lastError: undefined,
    lastSignupEvent: undefined,
    lastSignupEventAt: undefined,
    launchChecklist: [],
    onboardingUrl: "",
    updatedAt,
  };
}
