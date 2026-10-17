import "server-only";
import { NextResponse } from "next/server";
import { requireSessionRole } from "@/lib/api/require-session-role";
import { resolveSessionTenantId } from "@/lib/api/resolve-session-tenant";
import { ensureWhatsAppConnectionDraftFromFile, getWhatsAppConnectionStateFromFile, ensureWhatsAppConnectionStateFromFile, updateWhatsAppConnectionStateFromFile } from "@/lib/gigxomi/dummy-platform-file-store";
import {
  exchangeMetaAuthorizationCode,
  fetchMetaWhatsAppSetupSummary,
  registerWhatsAppPhoneNumber,
  subscribeAppToWhatsAppBusinessAccount,
} from "@/lib/gigxomi/meta-whatsapp-auth";
import type { DummyWhatsAppConnectionState } from "@/lib/gigxomi/dummy-platform-store";
import { redactMetaDiagnostics } from "@/lib/meta/redact";
import { prisma } from "@/lib/prisma";

export function publicWhatsAppConnection(connection: DummyWhatsAppConnectionState | null) {
  if (!connection) return null;
  return { ...connection, accessToken: "", authorizationCode: "", hasAccessToken: Boolean(connection.accessToken), hasAuthorizationCode: Boolean(connection.authorizationCode) };
}

export async function handleWhatsAppSetup(request: Request, action: "state" | "finalize" | "refresh" | "subscribe" | "register") {
  const auth = await requireSessionRole(["SUPER_ADMIN", "ADMIN"]);
  if (!auth.ok) return auth.response;
  try {
    const body = request.method === "GET" ? {} : await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ ok: false, code: "INVALID_REQUEST", error: "Provide a valid setup request." }, { status: 400 });
    }
    const requestedTenant = new URL(request.url).searchParams.get("tenantId") || body.tenantId;
    if (requestedTenant && auth.session.role !== "SUPER_ADMIN" && requestedTenant !== auth.session.tenantId) {
      return NextResponse.json({ ok: false, code: "TENANT_ACCESS_DENIED", error: "This connection belongs to another workspace." }, { status: 403 });
    }
    const tenantId = resolveSessionTenantId(auth.session, requestedTenant);
    let loaded: DummyWhatsAppConnectionState | null = await getWhatsAppConnectionStateFromFile(tenantId);
    if (!loaded) {
      await ensureWhatsAppConnectionDraftFromFile({ tenantId, businessName: auth.session.displayName });
      loaded = await updateWhatsAppConnectionStateFromFile(tenantId, { metaAppId: process.env.META_WHATSAPP_APP_ID || "1385995129001581", metaConfigId: process.env.META_WHATSAPP_CONFIG_ID || "", publicBaseUrl: process.env.NEXT_PUBLIC_APP_URL || "https://app.aicloser.in" });
    }
    if (!loaded) throw new Error("Unable to load this workspace connection.");
    let connection: DummyWhatsAppConnectionState = loaded;

    // WhatsApp Marketing stores the authoritative tenant channel in Prisma.
    // Hydrate the legacy onboarding snapshot for display/actions without
    // copying or exposing the encrypted access token.
    // The local app can run with the file-backed tenant store when no direct
    // frontend DATABASE_URL is configured. Prisma is intentionally optional
    // here: touching the lazy Prisma proxy without a configured database
    // throws before the setup draft can be returned.
    let savedChannel: Awaited<ReturnType<typeof prisma.whatsAppChannel.findFirst>> = null;
    if (process.env.DATABASE_URL?.trim()) {
      try {
        savedChannel = await prisma.whatsAppChannel.findFirst({
          where: { tenantId },
          orderBy: { updatedAt: "desc" },
        });
      } catch (error) {
        // Keep the setup screen usable from the file-backed store if the
        // optional Prisma connection is unavailable or has a stale schema.
        console.warn("[WHATSAPP_SETUP_DB_FALLBACK]", error instanceof Error ? error.message : error);
      }
    }
    if (savedChannel) {
      connection = {
        ...connection,
        pluginEnabled: savedChannel.status === "ACTIVE",
        status: savedChannel.status === "ACTIVE" ? "Number connected" : "Not started",
        displayName: savedChannel.verifiedName || connection.displayName,
        phoneNumber: savedChannel.displayPhoneNumber || connection.phoneNumber,
        businessId: savedChannel.businessId || connection.businessId,
        businessPortfolioId: savedChannel.businessPortfolioId || connection.businessPortfolioId,
        wabaId: savedChannel.wabaId || connection.wabaId,
        phoneNumberId: savedChannel.phoneNumberId || connection.phoneNumberId,
        graphApiVersion: savedChannel.graphApiVersion || connection.graphApiVersion,
        note: savedChannel.status === "ACTIVE"
          ? "Connected from this workspace's tenant-scoped Meta channel."
          : connection.note,
        lastError: savedChannel.status === "ACTIVE" ? "" : connection.lastError,
        updatedAt: savedChannel.updatedAt.toISOString(),
      };
    }
    if (action === "state") {
      if (request.method === "POST") {
        const updates: Partial<DummyWhatsAppConnectionState> = {};
        for (const key of ["lastSignupEvent", "lastSignupEventAt", "lastLaunchAt", "note"] as const) {
          if (typeof body[key] === "string") updates[key] = body[key].slice(0, 2000);
        }
        if (typeof body.pluginEnabled === "boolean") updates.pluginEnabled = body.pluginEnabled;
        connection = (await updateWhatsAppConnectionStateFromFile(tenantId, updates)) ?? connection;
      } else if (new URL(request.url).searchParams.get("sync") === "1") {
        connection = (await ensureWhatsAppConnectionStateFromFile(tenantId)) ?? connection;
      }

      // A previously completed signup may predate automatic webhook
      // subscription. Re-running the tenant-scoped state read is safe and
      // makes an already-connected line start receiving inbound events
      // without requiring the admin to reconnect the number.
      if (request.method === "GET" && connection.accessToken && connection.wabaId && connection.pluginEnabled) {
        // Refresh the display metadata from Meta for this tenant before
        // returning the state. The legacy channel snapshot can contain a
        // stale phone label even though the encrypted tenant connection is
        // already valid; never use that stale value as the connected line.
        const setupSummary = await fetchMetaWhatsAppSetupSummary({
          accessToken: connection.accessToken,
          graphApiVersion: connection.graphApiVersion,
          knownBusinessId: connection.businessId,
          knownBusinessPortfolioId: connection.businessPortfolioId,
          knownWabaId: connection.wabaId,
          knownPhoneNumberId: connection.phoneNumberId,
          knownPhoneNumber: connection.phoneNumber,
          knownDisplayName: connection.displayName,
          knownBusinessName: connection.businessName,
          manualOverrides: connection.manualOverrides,
        }).catch(() => null);
        if (setupSummary?.ok) {
          connection = (await updateWhatsAppConnectionStateFromFile(tenantId, {
            businessId: setupSummary.businessId || connection.businessId,
            businessPortfolioId: setupSummary.businessPortfolioId || connection.businessPortfolioId,
            businessName: setupSummary.businessName || connection.businessName,
            displayName: setupSummary.displayName || connection.displayName,
            phoneNumber: setupSummary.phoneNumber || connection.phoneNumber,
            wabaId: setupSummary.wabaId || connection.wabaId,
            phoneNumberId: setupSummary.phoneNumberId || connection.phoneNumberId,
          })) ?? connection;
        }
        const subscription = await subscribeAppToWhatsAppBusinessAccount({
          accessToken: connection.accessToken,
          wabaId: connection.wabaId,
          graphApiVersion: connection.graphApiVersion,
        });
        connection = (await updateWhatsAppConnectionStateFromFile(tenantId, {
          lastError: subscription.ok ? "" : subscription.error,
          note: subscription.ok
            ? "WhatsApp line connected and webhook subscription confirmed."
            : "WhatsApp connected, but Meta webhook subscription needs attention.",
        })) ?? connection;
      }
    } else if (action === "finalize" || action === "refresh") {
      let subscriptionError = "";
      const code = action === "finalize" ? String(body.authorizationCode || "").trim() : connection.authorizationCode;
      if (!code) return NextResponse.json({ ok: false, code: "META_RECONNECT_REQUIRED", error: "Connect WhatsApp again to obtain fresh authorization.", connection: publicWhatsAppConnection(connection) }, { status: 409 });
      const exchange = await exchangeMetaAuthorizationCode({ appId: connection.metaAppId, authorizationCode: code, graphApiVersion: connection.graphApiVersion });
      if (!exchange.ok) return NextResponse.json({ ok: false, code: "META_TOKEN_EXCHANGE_FAILED", error: exchange.error, connection: publicWhatsAppConnection(connection) }, { status: 502 });

      const knownBusinessId = String(body.businessId || connection.businessId || "").trim();
      const knownBusinessPortfolioId = String(body.businessPortfolioId || connection.businessPortfolioId || "").trim();
      const knownWabaId = String(body.wabaId || connection.wabaId || "").trim();
      const knownPhoneNumberId = String(body.phoneNumberId || connection.phoneNumberId || "").trim();
      const knownPhoneNumber = String(body.phoneNumber || connection.phoneNumber || "").trim();
      const knownDisplayName = String(body.displayName || connection.displayName || "").trim();
      const knownBusinessName = String(body.businessName || connection.businessName || "").trim();
      const setupSummary = await fetchMetaWhatsAppSetupSummary({
        accessToken: exchange.accessToken,
        graphApiVersion: connection.graphApiVersion,
        knownBusinessId,
        knownBusinessPortfolioId,
        knownWabaId,
        knownPhoneNumberId,
        knownPhoneNumber,
        knownDisplayName,
        knownBusinessName,
        manualOverrides: connection.manualOverrides,
      }).catch(() => null);

      const resolved = setupSummary?.ok ? setupSummary : null;
      connection = (await updateWhatsAppConnectionStateFromFile(tenantId, {
        accessToken: exchange.accessToken,
        authorizationCode: "",
        pluginEnabled: true,
        status: resolved?.phoneNumberId ? "Number connected" : "Business submitted",
        businessId: resolved?.businessId || knownBusinessId,
        businessPortfolioId: resolved?.businessPortfolioId || knownBusinessPortfolioId,
        businessName: resolved?.businessName || knownBusinessName,
        displayName: resolved?.displayName || knownDisplayName,
        phoneNumber: resolved?.phoneNumber || knownPhoneNumber || knownPhoneNumberId,
        wabaId: resolved?.wabaId || knownWabaId,
        phoneNumberId: resolved?.phoneNumberId || knownPhoneNumberId,
        lastError: "",
        note: resolved?.phoneNumber
          ? "WhatsApp line connected from Meta signup."
          : "Meta token exchanged. Waiting for Meta to return the display phone number.",
      })) ?? connection;
      connection = (await ensureWhatsAppConnectionStateFromFile(tenantId)) ?? connection;

      // Embedded signup authorizes the WABA, but Meta still requires the app
      // to be subscribed before webhook events (and therefore new chats) are
      // delivered. Do this automatically for this tenant's WABA after every
      // successful token exchange/refresh.
      if (connection.accessToken && connection.wabaId) {
        const subscription = await subscribeAppToWhatsAppBusinessAccount({
          accessToken: connection.accessToken,
          wabaId: connection.wabaId,
          graphApiVersion: connection.graphApiVersion,
        });
        if (!subscription.ok) subscriptionError = subscription.error;
      }

      if (subscriptionError) {
        connection = (await updateWhatsAppConnectionStateFromFile(tenantId, {
          lastError: subscriptionError,
          note: "WhatsApp connected, but Meta webhook subscription needs attention.",
        })) ?? connection;
      }
    } else {
      if (!connection.accessToken || (action === "register" ? !connection.phoneNumberId : !connection.wabaId)) {
        return NextResponse.json({ ok: false, code: "META_CONNECTION_INCOMPLETE", error: "Complete Meta signup before this step." }, { status: 409 });
      }
      if (action === "register" && body.registrationPin && !/^\d{6}$/.test(String(body.registrationPin))) {
        return NextResponse.json({ ok: false, code: "INVALID_REGISTRATION_PIN", error: "Registration PIN must contain six digits." }, { status: 400 });
      }
      const result = action === "register"
        ? await registerWhatsAppPhoneNumber({ accessToken: connection.accessToken, phoneNumberId: connection.phoneNumberId, pin: String(body.registrationPin || ""), graphApiVersion: connection.graphApiVersion })
        : await subscribeAppToWhatsAppBusinessAccount({ accessToken: connection.accessToken, wabaId: connection.wabaId, graphApiVersion: connection.graphApiVersion });
      if (!result.ok) return NextResponse.json({ ok: false, code: "META_SETUP_STEP_FAILED", error: result.error, connection: publicWhatsAppConnection(connection) }, { status: 502 });
    }
    return NextResponse.json({
      ok: true,
      connection: publicWhatsAppConnection(connection),
      ...(action === "finalize" || action === "refresh"
        ? { webhookSubscribed: !connection.lastError, ...(connection.lastError ? { subscriptionError: connection.lastError } : {}) }
        : {}),
    });
  } catch (error) {
    console.error("[META_SETUP_FAILED]", redactMetaDiagnostics({ action, message: error instanceof Error ? error.message : "Unexpected failure" }));
    if (error instanceof SyntaxError) return NextResponse.json({ ok: false, code: "INVALID_REQUEST", error: "Provide valid JSON." }, { status: 400 });
    return NextResponse.json({ ok: false, code: "META_SETUP_FAILED", error: "WhatsApp setup could not complete. Check the server configuration and retry." }, { status: 500 });
  }
}
