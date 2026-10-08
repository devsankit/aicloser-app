import "server-only";
import { NextResponse } from "next/server";
import { requireSessionRole } from "@/lib/api/require-session-role";
import { resolveSessionTenantId } from "@/lib/api/resolve-session-tenant";
import { ensureWhatsAppConnectionDraftFromFile, getWhatsAppConnectionStateFromFile, ensureWhatsAppConnectionStateFromFile, updateWhatsAppConnectionStateFromFile } from "@/lib/gigxomi/dummy-platform-file-store";
import { exchangeMetaAuthorizationCode, registerWhatsAppPhoneNumber, subscribeAppToWhatsAppBusinessAccount } from "@/lib/gigxomi/meta-whatsapp-auth";
import type { DummyWhatsAppConnectionState } from "@/lib/gigxomi/dummy-platform-store";
import { redactMetaDiagnostics } from "@/lib/meta/redact";

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
    let connection: DummyWhatsAppConnectionState | null = await getWhatsAppConnectionStateFromFile(tenantId);
    if (!connection) {
      await ensureWhatsAppConnectionDraftFromFile({ tenantId, businessName: auth.session.displayName });
      connection = await updateWhatsAppConnectionStateFromFile(tenantId, { metaAppId: process.env.META_WHATSAPP_APP_ID || "1385995129001581", metaConfigId: process.env.META_WHATSAPP_CONFIG_ID || "", publicBaseUrl: process.env.NEXT_PUBLIC_APP_URL || "https://app.aicloser.in" });
    }
    if (!connection) throw new Error("Unable to load this workspace connection.");
    if (action === "state") {
      if (request.method === "POST") {
        const updates: Partial<DummyWhatsAppConnectionState> = {};
        for (const key of ["lastSignupEvent", "lastSignupEventAt", "lastLaunchAt", "note"] as const) {
          if (typeof body[key] === "string") updates[key] = body[key].slice(0, 2000);
        }
        if (typeof body.pluginEnabled === "boolean") updates.pluginEnabled = body.pluginEnabled;
        connection = await updateWhatsAppConnectionStateFromFile(tenantId, updates);
      } else if (new URL(request.url).searchParams.get("sync") === "1") {
        connection = await ensureWhatsAppConnectionStateFromFile(tenantId);
      }
    } else if (action === "finalize" || action === "refresh") {
      const code = action === "finalize" ? String(body.authorizationCode || "").trim() : connection.authorizationCode;
      if (!code) return NextResponse.json({ ok: false, code: "META_RECONNECT_REQUIRED", error: "Connect WhatsApp again to obtain fresh authorization.", connection: publicWhatsAppConnection(connection) }, { status: 409 });
      const exchange = await exchangeMetaAuthorizationCode({ appId: connection.metaAppId, authorizationCode: code, graphApiVersion: connection.graphApiVersion });
      if (!exchange.ok) return NextResponse.json({ ok: false, code: "META_TOKEN_EXCHANGE_FAILED", error: exchange.error, connection: publicWhatsAppConnection(connection) }, { status: 502 });
      connection = await updateWhatsAppConnectionStateFromFile(tenantId, { accessToken: exchange.accessToken, authorizationCode: "", pluginEnabled: true, wabaId: String(body.wabaId || connection.wabaId), phoneNumberId: String(body.phoneNumberId || connection.phoneNumberId), lastError: "" });
      connection = await ensureWhatsAppConnectionStateFromFile(tenantId);
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
    return NextResponse.json({ ok: true, connection: publicWhatsAppConnection(connection) });
  } catch (error) {
    console.error("[META_SETUP_FAILED]", redactMetaDiagnostics({ action, message: error instanceof Error ? error.message : "Unexpected failure" }));
    if (error instanceof SyntaxError) return NextResponse.json({ ok: false, code: "INVALID_REQUEST", error: "Provide valid JSON." }, { status: 400 });
    return NextResponse.json({ ok: false, code: "META_SETUP_FAILED", error: "WhatsApp setup could not complete. Check the server configuration and retry." }, { status: 500 });
  }
}
