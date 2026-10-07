import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSessionRole } from "@/lib/api/require-session-role";
import { resolveSessionTenantId } from "@/lib/api/resolve-session-tenant";
import { verifyChannelConnection } from "@/lib/whatsapp-marketing/meta-client";
import {
  encryptSecureToken,
  decryptSecureToken,
  REQUESTED_BUSINESS_PHONE,
  getBootstrapConfig,
  isMockMode,
  META_GRAPH_API_VERSION,
} from "@/lib/whatsapp-marketing/config";

export async function GET(request: Request) {
  const auth = await requireSessionRole(["SUPER_ADMIN", "ADMIN", "SALES_AGENT"]);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const tenantId = resolveSessionTenantId(auth.session, url.searchParams.get("tenantId"));

  const channel = await prisma.whatsAppChannel.findFirst({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
  });

  const bootstrap = getBootstrapConfig();
  const mockActive = isMockMode();

  if (!channel) {
    return NextResponse.json({
      ok: true,
      connected: false,
      requestedPhone: REQUESTED_BUSINESS_PHONE,
      mockMode: mockActive,
      bootstrapAvailable: Boolean(bootstrap.phoneNumberId && bootstrap.wabaId),
      bootstrapDefaults: {
        wabaId: bootstrap.wabaId,
        phoneNumberId: bootstrap.phoneNumberId,
        hasAccessToken: Boolean(bootstrap.accessToken),
      },
      channel: null,
    });
  }

  const cleanRequested = REQUESTED_BUSINESS_PHONE.replace(/\D/g, "");
  const cleanDisplay = (channel.displayPhoneNumber || "").replace(/\D/g, "");
  const matchesRequested = cleanDisplay.endsWith(cleanRequested) || cleanRequested.endsWith(cleanDisplay);

  return NextResponse.json({
    ok: true,
    connected: channel.status === "ACTIVE",
    requestedPhone: REQUESTED_BUSINESS_PHONE,
    matchesRequestedPhone: matchesRequested,
    mockMode: mockActive,
    channel: {
      id: channel.id,
      tenantId: channel.tenantId,
      businessPortfolioId: channel.businessPortfolioId,
      wabaId: channel.wabaId,
      phoneNumberId: channel.phoneNumberId,
      displayPhoneNumber: channel.displayPhoneNumber,
      verifiedName: channel.verifiedName,
      qualityRating: channel.qualityRating,
      messagingLimitTier: channel.messagingLimitTier,
      status: channel.status,
      graphApiVersion: channel.graphApiVersion,
      hasAccessToken: Boolean(channel.encryptedAccessToken),
      hasDedicatedWebhookToken: Boolean(channel.webhookVerifyToken),
      lastSyncedAt: channel.lastSyncedAt,
    },
  });
}

export async function POST(request: Request) {
  const auth = await requireSessionRole(["SUPER_ADMIN", "ADMIN", "SALES_AGENT"]);
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ ok: false, error: "Invalid JSON payload." }, { status: 400 });
  }

  const tenantId = resolveSessionTenantId(auth.session, body.tenantId as string);
  const phoneNumberId = String(body.phoneNumberId || "").trim();
  const wabaId = String(body.wabaId || "").trim();
  const accessToken = String(body.accessToken || "").trim();
  const businessPortfolioId = body.businessPortfolioId ? String(body.businessPortfolioId).trim() : null;
  const webhookVerifyToken = body.webhookVerifyToken ? String(body.webhookVerifyToken).trim() : null;
  const graphApiVersion = String(body.graphApiVersion || META_GRAPH_API_VERSION).trim();

  // Validate raw phone vs Meta phone ID
  if (phoneNumberId.replace(/\D/g, "") === REQUESTED_BUSINESS_PHONE.replace(/\D/g, "")) {
    return NextResponse.json(
      {
        ok: false,
        error: "The Phone Number ID must be the Meta numeric API identifier (e.g. 962346373625331), not the raw phone number digits.",
      },
      { status: 400 },
    );
  }

  if (!phoneNumberId || !wabaId) {
    return NextResponse.json(
      { ok: false, error: "Both Phone Number ID and WhatsApp Business Account ID (WABA ID) are required." },
      { status: 400 },
    );
  }

  const bootstrap = getBootstrapConfig();
  let finalAccessToken = accessToken || bootstrap.accessToken;

  if (!finalAccessToken) {
    // Check existing channel in database
    const existing = await prisma.whatsAppChannel.findFirst({ where: { tenantId, phoneNumberId } });
    if (existing?.encryptedAccessToken) {
      finalAccessToken = decryptSecureToken(existing.encryptedAccessToken);
    }
  }

  if (!finalAccessToken && !isMockMode()) {
    return NextResponse.json({ ok: false, error: "A valid Meta access token is required." }, { status: 400 });
  }

  // Verify against Meta Graph API (or mock engine)
  const metaVerification = await verifyChannelConnection({
    phoneNumberId,
    accessToken: finalAccessToken || "mock_token_gxclosers",
    wabaId,
  });

  if (!metaVerification.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: `Meta validation failed: ${metaVerification.error}`,
        statusCode: metaVerification.statusCode,
      },
      { status: 400 },
    );
  }

  const verifiedData = metaVerification.data;
  const displayPhoneNumber = verifiedData.phoneNumber.display_phone_number || "+91 99933 28124";
  const verifiedName = verifiedData.phoneNumber.verified_name || (body.verifiedName as string) || "Gigxomi Support";
  const qualityRating = verifiedData.phoneNumber.quality_rating || "GREEN";
  const messagingLimitTier = verifiedData.phoneNumber.messaging_limit_tier || "TIER_1K";

  const encryptedToken = finalAccessToken ? encryptSecureToken(finalAccessToken) : null;

  const channel = await prisma.whatsAppChannel.upsert({
    where: { phoneNumberId },
    update: {
      tenantId,
      wabaId,
      displayPhoneNumber,
      verifiedName,
      qualityRating,
      messagingLimitTier,
      businessPortfolioId,
      graphApiVersion,
      webhookVerifyToken: webhookVerifyToken || undefined,
      encryptedAccessToken: encryptedToken || undefined,
      status: "ACTIVE",
      lastSyncedAt: new Date(),
      updatedAt: new Date(),
    },
    create: {
      tenantId,
      wabaId,
      phoneNumberId,
      displayPhoneNumber,
      verifiedName,
      qualityRating,
      messagingLimitTier,
      businessPortfolioId,
      graphApiVersion,
      webhookVerifyToken,
      encryptedAccessToken: encryptedToken,
      status: "ACTIVE",
      lastSyncedAt: new Date(),
    },
  });

  // Audit log
  await prisma.whatsAppAuditLog.create({
    data: {
      tenantId,
      actorUserId: auth.session.userId,
      actorRole: auth.session.role,
      action: "WHATSAPP_CHANNEL_CONNECTED",
      entityType: "WhatsAppChannel",
      entityId: channel.id,
      details: {
        phoneNumberId,
        displayPhoneNumber,
        matchesRequestedNumber: verifiedData.matchesRequestedNumber,
        mockMode: isMockMode(),
      },
    },
  });

  return NextResponse.json({
    ok: true,
    matchesRequestedPhone: verifiedData.matchesRequestedNumber,
    requestedPhone: REQUESTED_BUSINESS_PHONE,
    mockMode: isMockMode(),
    channel: {
      id: channel.id,
      tenantId: channel.tenantId,
      businessPortfolioId: channel.businessPortfolioId,
      wabaId: channel.wabaId,
      phoneNumberId: channel.phoneNumberId,
      displayPhoneNumber: channel.displayPhoneNumber,
      verifiedName: channel.verifiedName,
      qualityRating: channel.qualityRating,
      messagingLimitTier: channel.messagingLimitTier,
      status: channel.status,
      graphApiVersion: channel.graphApiVersion,
      hasDedicatedWebhookToken: Boolean(channel.webhookVerifyToken),
    },
  });
}
