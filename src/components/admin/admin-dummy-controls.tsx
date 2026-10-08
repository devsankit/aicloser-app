"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useRef, useState } from "react";
import { CheckCheck, Copy, ExternalLink, MessageSquareShare } from "lucide-react";

import {
  DUMMY_WHATSAPP_MANUAL_OVERRIDE_KEYS,
  getWhatsAppWebhookUrl,
  META_WHATSAPP_ONBOARDING_URL,
  type DummyService,
  type DummyWhatsAppConnectionState,
  type DummyWhatsAppManualOverrideKey,
  type DummyWhatsAppManualOverrides,
  type DummyYouTubeConnectionState,
  type DummyYouTubeUploadRecord,
} from "@/lib/gigxomi/dummy-platform-store";
import { extractMetaEmbeddedSignupData, pickMetaText } from "@/lib/gigxomi/meta-whatsapp-signup";
import { redactMetaDiagnostics } from "@/lib/meta/redact";

type WhatsAppTenantOption = {
  id: string;
  name: string;
  phoneNumber?: string;
};

type WhatsAppManualDrafts = Record<DummyWhatsAppManualOverrideKey, string>;
type WhatsAppSetupProgress =
  | "idle"
  | "opening"
  | "waiting"
  | "exchanging"
  | "registering"
  | "subscribing"
  | "refreshing"
  | "connected"
  | "pending"
  | "error";

const WHATSAPP_SETUP_PROGRESS_LABELS: Record<WhatsAppSetupProgress, string> = {
  idle: "",
  opening: "Opening Meta signup",
  waiting: "Waiting for Meta response",
  exchanging: "Exchanging token",
  registering: "Registering phone number",
  subscribing: "Subscribing webhook",
  refreshing: "Refreshing connection",
  connected: "Connected",
  pending: "Waiting for Meta setup IDs",
  error: "Needs attention",
};

function buildManualWhatsAppDrafts(connection?: DummyWhatsAppConnectionState | null): WhatsAppManualDrafts {
  return {
    businessName: connection?.businessName ?? "",
    displayName: connection?.displayName ?? "",
    phoneNumber: connection?.phoneNumber ?? "",
    businessId: connection?.businessId ?? "",
    businessPortfolioId: connection?.businessPortfolioId ?? "",
    wabaId: connection?.wabaId ?? "",
    phoneNumberId: connection?.phoneNumberId ?? "",
    systemUserId: connection?.systemUserId ?? "",
  };
}

function normalizeManualOverrides(
  overrides?: Partial<DummyWhatsAppManualOverrides> | null,
): DummyWhatsAppManualOverrides {
  return DUMMY_WHATSAPP_MANUAL_OVERRIDE_KEYS.reduce<DummyWhatsAppManualOverrides>(
    (accumulator, key) => {
      accumulator[key] = Boolean(overrides?.[key]);
      return accumulator;
    },
    {
      phoneNumber: false,
      phoneNumberId: false,
      wabaId: false,
      businessPortfolioId: false,
      businessId: false,
      displayName: false,
      businessName: false,
      systemUserId: false,
    },
  );
}

const WHATSAPP_MANUAL_OVERRIDE_LABELS: Record<DummyWhatsAppManualOverrideKey, string> = {
  businessName: "Business name",
  displayName: "Display name",
  phoneNumber: "WhatsApp number",
  businessId: "Meta business ID",
  businessPortfolioId: "Business portfolio ID",
  wabaId: "WhatsApp Business Account ID",
  phoneNumberId: "Phone number ID",
  systemUserId: "System user ID",
};

async function fetchPendingServices() {
  const response = await fetch("/api/freelancer/services", { cache: "no-store" });
  const payload = await response.json();
  return ((payload.services ?? []) as DummyService[]).filter((service) => service.status === "Pending Review");
}

async function fetchWhatsAppConnection(tenantId?: string, options?: { sync?: boolean }) {
  const searchParams = new URLSearchParams();
  if (tenantId?.trim()) {
    searchParams.set("tenantId", tenantId.trim());
    searchParams.set("ensureDraft", "1");
  }
  if (options?.sync) {
    searchParams.set("sync", "1");
  }
  const query = searchParams.toString();
  const response = await fetch(`/api/admin/whatsapp${query ? `?${query}` : ""}`, { cache: "no-store", credentials: "include" });
  const payload = await response.json();
  return (payload.connection ?? null) as DummyWhatsAppConnectionState | null;
}

async function fetchYouTubeConnection() {
  const response = await fetch("/api/admin/youtube", { cache: "no-store", credentials: "include" });
  const payload = await response.json();
  return {
    connection: (payload.connection ?? null) as DummyYouTubeConnectionState | null,
    uploads: (payload.uploads ?? []) as DummyYouTubeUploadRecord[],
  };
}

function formatLaunchTime(value?: string) {
  if (!value) {
    return "Not launched yet";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatEventTime(value?: string) {
  if (!value) {
    return "Not received yet";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

type MetaEmbeddedSignupSignal = {
  event: "FINISH" | "ERROR" | "CANCEL" | "CODE" | "TOKEN" | "TIMEOUT";
  data?: Record<string, unknown>;
  code?: string;
  accessToken?: string;
};

type FacebookAuthResponse = {
  code?: string;
  accessToken?: string;
};

type FacebookLoginResponse = {
  authResponse?: FacebookAuthResponse | null;
  status?: string;
};

type WhatsAppFinalizeSignupResponse = {
  ok?: boolean;
  error?: string;
  exchangeError?: string | null;
  summaryError?: string | null;
  registrationAttempted?: boolean;
  registrationError?: string | null;
  metaRegistrationResponse?: unknown;
  subscriptionError?: string | null;
  connection?: DummyWhatsAppConnectionState | null;
};

type FacebookSdk = {
  init(config: {
    appId: string;
    autoLogAppEvents?: boolean;
    xfbml?: boolean;
    version: string;
  }): void;
  login(
    callback: (response: FacebookLoginResponse) => void,
    options: {
      config_id: string;
      response_type: string;
      override_default_response_type: boolean;
      scope?: string;
      extras: Record<string, unknown>;
    },
  ): void;
};

const META_SIGNUP_STORAGE_KEY = "gigxomi-meta-whatsapp-signup-result";
const META_EMBEDDED_SIGNUP_APP_ID = "1385995129001581";
// Embedded Signup configuration IDs are public launch parameters; keep the
// app secret and authorization-code exchange on the server.
const META_EMBEDDED_SIGNUP_CONFIG_ID = "899249879744989";
const META_EMBEDDED_SIGNUP_VERSION = "v4";
const META_SESSION_INFO_VERSION = "3";
const META_SIGNUP_CODE_FALLBACK_MS = 1000 * 60 * 2;
const META_EMBEDDED_SIGNUP_FEATURE_TYPE = "whatsapp_business_app_onboarding";

declare global {
  interface Window {
    FB?: FacebookSdk;
    fbAsyncInit?: () => void;
  }
}

let facebookSdkPromise: Promise<FacebookSdk> | null = null;

function logWhatsAppOnboardingStep(step: string, payload?: unknown) {
  console.info(`[WHATSAPP_ONBOARDING] ${step}`, redactMetaDiagnostics(payload ?? {}));
}

function isMetaSignupOrigin(origin: string) {
  try {
    const hostname = new URL(origin).hostname.toLowerCase();
    return (
      hostname === "facebook.com" ||
      hostname.endsWith(".facebook.com") ||
      hostname === "fb.com" ||
      hostname.endsWith(".fb.com") ||
      hostname === "connect.facebook.net"
    );
  } catch {
    return false;
  }
}

function ensureFacebookSdkLoaded() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Facebook SDK is only available in the browser."));
  }

  if (window.FB) {
    return Promise.resolve(window.FB);
  }

  if (facebookSdkPromise) {
    return facebookSdkPromise;
  }

  facebookSdkPromise = new Promise<FacebookSdk>((resolve, reject) => {
    const existingScript = document.getElementById("facebook-jssdk") as HTMLScriptElement | null;
    const finish = () => {
      if (window.FB) {
        resolve(window.FB);
        return;
      }

      reject(new Error("Facebook SDK loaded, but Meta login is still unavailable."));
    };

    if (existingScript) {
      existingScript.addEventListener("load", finish, { once: true });
      existingScript.addEventListener("error", () => reject(new Error("Unable to load the Facebook SDK.")), { once: true });
      // A different client component may have loaded the SDK before this
      // panel mounted. In that case its load event has already fired, so
      // inspect the existing global once instead of waiting forever.
      window.setTimeout(finish, 0);
      return;
    }

    const script = document.createElement("script");
    script.id = "facebook-jssdk";
    script.async = true;
    script.defer = true;
    script.crossOrigin = "anonymous";
    script.src = "https://connect.facebook.net/en_US/sdk.js";
    script.addEventListener("load", finish, { once: true });
    script.addEventListener("error", () => reject(new Error("Unable to load the Facebook SDK.")), { once: true });
    document.head.appendChild(script);
  }).finally(() => {
    facebookSdkPromise = null;
  });

  return facebookSdkPromise;
}

function isSuspiciousPhoneNumberId(phoneNumberId?: string | null, references: Array<string | undefined | null> = []) {
  const candidate = phoneNumberId?.trim();
  if (!candidate) {
    return false;
  }

  return references.map((value) => value?.trim()).filter(Boolean).includes(candidate);
}

function isAccountNotRegisteredError(value?: string | null) {
  const normalized = String(value ?? "").toLowerCase();
  return normalized.includes("133010") || normalized.includes("account not registered");
}

function isRegistrationPinRequiredError(value?: string | null) {
  const normalized = String(value ?? "").toLowerCase();
  return (
    normalized.includes("parameter pin is required") ||
    normalized.includes("pin is required") ||
    normalized.includes("two-step") ||
    normalized.includes("two factor") ||
    normalized.includes("two-factor")
  );
}

function needsPhoneRegistrationRetry(connection: DummyWhatsAppConnectionState | null) {
  return Boolean(
    isAccountNotRegisteredError(connection?.lastError) ||
      isAccountNotRegisteredError(connection?.note) ||
      isRegistrationPinRequiredError(connection?.lastError) ||
      isRegistrationPinRequiredError(connection?.note),
  );
}

function getPreferredConnectionPhoneNumber(
  connection: DummyWhatsAppConnectionState | null,
  fallbackPhoneNumber?: string | null,
) {
  const savedPhoneNumber = connection?.phoneNumber?.trim() ?? "";
  const fallback = String(fallbackPhoneNumber ?? "").trim();

  if (!savedPhoneNumber) {
    return fallback;
  }

  if (!fallback) {
    return savedPhoneNumber;
  }

  if (!connection?.phoneNumberId?.trim()) {
    return fallback;
  }

  return savedPhoneNumber;
}

function hasWhatsAppToken(connection: DummyWhatsAppConnectionState | null) {
  return Boolean(connection?.hasAccessToken || connection?.accessToken?.trim());
}

function hasCapturedWhatsAppLine(connection: DummyWhatsAppConnectionState | null) {
  if (!connection) {
    return false;
  }

  return Boolean(connection.phoneNumberId?.trim());
}

function hasSubmittedWhatsAppBusiness(connection: DummyWhatsAppConnectionState | null) {
  if (!connection) {
    return false;
  }

  return Boolean(
    hasWhatsAppToken(connection) ||
      connection.wabaId?.trim() ||
      connection.businessId?.trim() ||
      connection.businessPortfolioId?.trim() ||
      connection.status === "Business submitted" ||
      connection.status === "Number connected" ||
      connection.status === "Ready for webhook",
  );
}

function getVisibleWhatsAppLineNumber(connection: DummyWhatsAppConnectionState | null) {
  if (!connection) {
    return "";
  }

  const savedMetaNumber = connection.phoneNumber?.trim() ?? "";
  if (savedMetaNumber) {
    return savedMetaNumber;
  }

  return hasCapturedWhatsAppLine(connection) ? connection.phoneNumberId?.trim() || getPreferredConnectionPhoneNumber(connection, "") : "";
}

function hasReadyWhatsAppLine(connection: DummyWhatsAppConnectionState | null) {
  return hasUsableWhatsAppLine(connection);
}

function hasUsableWhatsAppLine(connection: DummyWhatsAppConnectionState | null) {
  return Boolean(hasWhatsAppToken(connection) && connection?.phoneNumberId?.trim());
}

function isDisconnectedWhatsAppLine(connection: DummyWhatsAppConnectionState | null) {
  if (!connection) {
    return false;
  }

  const status = connection.status.trim().toLowerCase();
  if (status === "disconnected") {
    return true;
  }

  return Boolean(connection.pluginEnabled && !hasUsableWhatsAppLine(connection) && !connection.lastSignupEvent?.trim());
}

function getWhatsAppSetupProgressLabel(progress: WhatsAppSetupProgress, connection: DummyWhatsAppConnectionState | null) {
  if (progress === "idle") {
    return "";
  }

  if (progress === "pending") {
    if (!hasWhatsAppToken(connection)) {
      return "Waiting for Meta auth code";
    }

    if (!connection?.phoneNumberId?.trim()) {
      return "Waiting for Meta phone ID";
    }

    return "Connected; checking phone registration";
  }

  return WHATSAPP_SETUP_PROGRESS_LABELS[progress];
}

function getWhatsAppConnectionDisplay(connection: DummyWhatsAppConnectionState | null) {
  if (!connection) {
    return {
      badge: "Not started",
      headline: "No WhatsApp number connected",
      detail: "Launch Meta signup and AI Closer will capture the authorization code, WABA, and Cloud API phone ID.",
    };
  }

  const connectedNumber = getVisibleWhatsAppLineNumber(connection);

  if (isDisconnectedWhatsAppLine(connection)) {
    return {
      badge: "Disconnected",
      headline: "WhatsApp disconnected",
      detail: "Reconnect WhatsApp to capture a fresh Meta token and Cloud API phone number ID.",
    };
  }

  if (connectedNumber) {
    return {
      badge: hasReadyWhatsAppLine(connection) ? "Connected" : connection.status,
      headline: connectedNumber,
      detail: hasCapturedWhatsAppLine(connection)
        ? "WhatsApp line connected from Meta signup for this agency."
        : "Meta returned this WhatsApp number. AI Closer is waiting for Meta to return the phone number ID before live inbox routing can start.",
    };
  }

  if (connection.phoneNumberId?.trim()) {
    return {
      badge: hasReadyWhatsAppLine(connection) ? "Connected" : "Ready for registration",
      headline: `Phone ID ${connection.phoneNumberId.trim()}`,
      detail: hasReadyWhatsAppLine(connection)
        ? "AI Closer captured the Meta token and Cloud API phone ID. Registration and webhook checks can continue without hiding the connected line."
        : "Meta returned the Cloud API phone ID. AI Closer is waiting for the Meta token before registration and webhook checks can run.",
    };
  }

  if (hasSubmittedWhatsAppBusiness(connection)) {
    return {
      badge: connection.status === "Number connected" ? "Business submitted" : connection.status,
      headline: "Meta account connected",
      detail: "AI Closer has Meta business data, but registration cannot start until Meta returns the Cloud API phone number ID.",
    };
  }

  if (connection.lastSignupEvent?.trim() && connection.status === "Onboarding in progress") {
    return {
      badge: "Waiting for Meta IDs",
      headline: "Meta signup did not return a phone ID yet",
      detail: "Registration is waiting for Meta to return an authorization code, WABA ID, or Cloud API phone number ID from the signup flow.",
    };
  }

  return {
    badge: connection.status,
    headline: "No WhatsApp number connected",
    detail: "Launch Meta signup and AI Closer will connect the selected Cloud API business line.",
  };
}

function shouldOfferReconnect(connection: DummyWhatsAppConnectionState | null) {
  if (!connection) {
    return false;
  }

  if (isAccountNotRegisteredError(connection.lastError)) {
    return true;
  }

  return Boolean(
    connection.lastLaunchAt?.trim() ||
      connection.businessId.trim() ||
      connection.businessPortfolioId.trim() ||
      connection.wabaId.trim() ||
      connection.phoneNumberId.trim() ||
      connection.authorizationCode.trim() ||
      connection.accessToken.trim(),
  );
}

function buildEmbeddedSignupPrefill(connection: DummyWhatsAppConnectionState) {
  return {
    business: {
      id: connection.businessId.trim() || null,
      name: connection.businessName.trim() || null,
      email: null,
      phone: {
        code: null,
        number: null,
      },
      website: null,
      address: {
        streetAddress1: null,
        streetAddress2: null,
        city: null,
        state: null,
        zipPostal: null,
        country: null,
      },
      timezone: null,
    },
    phone: {
      displayName: connection.displayName.trim() || null,
      category: null,
      description: null,
    },
    preVerifiedPhone: {
      ids: null,
    },
    solutionID: null,
    whatsAppBusinessAccount: {
      ids: connection.wabaId.trim() ? [connection.wabaId.trim()] : null,
    },
  };
}

function buildEmbeddedSignupExtras(connection: DummyWhatsAppConnectionState) {
  return {
    version: connection.embeddedSignupVersion.trim() || META_EMBEDDED_SIGNUP_VERSION,
    setup: buildEmbeddedSignupPrefill(connection),
    featureType: META_EMBEDDED_SIGNUP_FEATURE_TYPE,
  };
}

function buildEmbeddedSignupUrl(connection: DummyWhatsAppConnectionState) {
  const appId = connection.metaAppId.trim() || META_EMBEDDED_SIGNUP_APP_ID;
  const configId = connection.metaConfigId.trim() || META_EMBEDDED_SIGNUP_CONFIG_ID;
  const sessionInfoVersion = connection.sessionInfoVersion.trim() || META_SESSION_INFO_VERSION;
  const embeddedSignupVersion = connection.embeddedSignupVersion.trim() || META_EMBEDDED_SIGNUP_VERSION;
  const publicBaseUrl = connection.publicBaseUrl.trim() || (typeof window !== "undefined" ? window.location.origin : "");

  if (!appId || !configId) {
    return connection.onboardingUrl || META_WHATSAPP_ONBOARDING_URL;
  }

  const url = new URL("https://business.facebook.com/messaging/whatsapp/onboard/");
  url.searchParams.set("app_id", appId);
  url.searchParams.set("config_id", configId);
  url.searchParams.set("display", "popup");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("override_default_response_type", "true");
  if (publicBaseUrl) {
    url.searchParams.set("redirect_uri", new URL("/meta/whatsapp/callback", publicBaseUrl).toString());
    url.searchParams.set("fallback_redirect_uri", new URL("/admin/integrations/whatsapp", publicBaseUrl).toString());
  }
  url.searchParams.set(
    "extras",
    JSON.stringify({
      setup: buildEmbeddedSignupPrefill(connection),
      featureType: META_EMBEDDED_SIGNUP_FEATURE_TYPE,
      sessionInfoVersion,
      version: embeddedSignupVersion,
    }),
  );
  return url.toString();
}

function mergeSignupSignals(primary: MetaEmbeddedSignupSignal, secondary?: MetaEmbeddedSignupSignal | null) {
  if (!secondary) {
    return primary;
  }

  const mergedData = {
    ...(primary.data ?? {}),
    ...(secondary.data ?? {}),
  };

  if (primary.event === "ERROR" || secondary.event === "ERROR") {
    return {
      event: "ERROR" as const,
      data: mergedData,
      code: secondary.code ?? primary.code,
      accessToken: secondary.accessToken ?? primary.accessToken,
    };
  }

  if (secondary.event === "FINISH" || primary.event === "FINISH" || Object.keys(mergedData).length) {
    return {
      event: "FINISH" as const,
      data: mergedData,
      code: secondary.code ?? primary.code,
      accessToken: secondary.accessToken ?? primary.accessToken,
    };
  }

  return {
    event: secondary.event === "TOKEN" ? secondary.event : primary.event,
    data: mergedData,
    code: secondary.code ?? primary.code,
    accessToken: secondary.accessToken ?? primary.accessToken,
  };
}

function normalizeSignupEventName(value: string) {
  const normalized = value.trim().toUpperCase();
  if (normalized === "FINISH" || normalized === "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING") {
    return "FINISH";
  }

  if (normalized === "CODE") {
    return "CODE";
  }

  if (normalized === "TOKEN") {
    return "TOKEN";
  }

  if (normalized === "ERROR") {
    return "ERROR";
  }

  if (normalized === "TIMEOUT") {
    return "TIMEOUT";
  }

  return "CANCEL";
}

function parseEmbeddedSignupSignal(data: unknown): MetaEmbeddedSignupSignal | null {
  if (typeof data === "string") {
    const rawParams = data.includes("#") ? data.slice(data.indexOf("#") + 1) : data.includes("?") ? data.slice(data.indexOf("?") + 1) : data;
    const codeParams = new URLSearchParams(rawParams);
    const code = codeParams.get("code")?.trim();
    if (code) {
      return {
        event: "CODE",
        code,
      };
    }

    try {
      const parsed = JSON.parse(data) as Record<string, unknown>;
      return parseEmbeddedSignupSignal(parsed);
    } catch {
      return null;
    }
  }

  if (!data || typeof data !== "object") {
    return null;
  }

  const payload = data as Record<string, unknown>;
  const type = pickMetaText(payload.type);
  const eventName = pickMetaText(payload.event);
  if (type === "GIGXOMI_WA_EMBEDDED_SIGNUP" && eventName) {
    const event = normalizeSignupEventName(eventName);
    const eventData = extractMetaEmbeddedSignupData(payload.data);

    return {
      event,
      data: eventData,
      code: pickMetaText(payload.code, eventData.code) || undefined,
      accessToken: pickMetaText(payload.accessToken, payload.access_token, eventData.access_token) || undefined,
    };
  }

  if (type !== "WA_EMBEDDED_SIGNUP" || !eventName) {
    return null;
  }

  const event = normalizeSignupEventName(eventName);
  const eventData = extractMetaEmbeddedSignupData(payload.data);

  return {
    event,
    data: eventData,
    code: pickMetaText(payload.code, eventData.code) || undefined,
    accessToken: pickMetaText(payload.accessToken, payload.access_token, eventData.access_token) || undefined,
  };
}

function waitForMetaEmbeddedSignupSignal(popup: Window | null, timeoutMs = 1000 * 60 * 8, codeFallbackMs = 15_000) {
  return new Promise<MetaEmbeddedSignupSignal>((resolve) => {
    let resolved = false;
    let pendingSignal: MetaEmbeddedSignupSignal | null = null;
    let pendingFallbackTimer: number | null = null;

    const finish = (result: MetaEmbeddedSignupSignal) => {
      if (resolved) {
        return;
      }

      resolved = true;
      window.removeEventListener("message", handleMessage);
      window.clearInterval(closeWatcher);
      window.clearInterval(storageWatcher);
      window.clearTimeout(timeoutId);
      if (pendingFallbackTimer) {
        window.clearTimeout(pendingFallbackTimer);
      }

      if (popup && !popup.closed && result.event !== "TIMEOUT") {
        popup.close();
      }

      resolve(result);
    };

    const settleOrWaitForFinalPayload = (signal: MetaEmbeddedSignupSignal) => {
      if (signal.event === "CODE" || signal.event === "TOKEN") {
        pendingSignal = pendingSignal ? mergeSignupSignals(pendingSignal, signal) : signal;
        if (!pendingFallbackTimer) {
          pendingFallbackTimer = window.setTimeout(() => {
            pendingFallbackTimer = null;
            if (pendingSignal) {
              finish(pendingSignal);
            }
          }, codeFallbackMs);
        }
        return;
      }

      if (pendingSignal && signal.event === "FINISH") {
        finish(mergeSignupSignals(pendingSignal, signal));
        return;
      }

      finish(signal);
    };

    const handleMessage = (event: MessageEvent) => {
      const sameOriginCallback =
        event.origin === window.location.origin &&
        Boolean(event.data && typeof event.data === "object" && pickMetaText((event.data as Record<string, unknown>).type) === "GIGXOMI_WA_EMBEDDED_SIGNUP");

      if (!sameOriginCallback && !isMetaSignupOrigin(event.origin)) {
        return;
      }

      const signal = parseEmbeddedSignupSignal(event.data);
      if (!signal) {
        return;
      }

      logWhatsAppOnboardingStep("STEP_2_POSTMESSAGE_RECEIVED", {
        origin: event.origin,
        data: event.data,
        parsed: signal,
      });
      if (signal.event === "FINISH") {
        logWhatsAppOnboardingStep("META_FINISH_RECEIVED", {
          origin: event.origin,
          data: event.data,
          parsed: signal,
        });
      }
      settleOrWaitForFinalPayload(signal);
    };

    const closeWatcher = window.setInterval(() => {
      if (popup && popup.closed && !resolved) {
        finish(pendingSignal ?? { event: "CANCEL" });
      }
    }, 500);

    const storageWatcher = window.setInterval(() => {
      try {
        const raw = localStorage.getItem(META_SIGNUP_STORAGE_KEY);
        if (!raw) {
          return;
        }

        localStorage.removeItem(META_SIGNUP_STORAGE_KEY);
        const signal = parseEmbeddedSignupSignal(raw);
        if (signal) {
          settleOrWaitForFinalPayload(signal);
        }
      } catch {
        // Ignore storage polling errors and continue waiting for postMessage.
      }
    }, 400);

    const timeoutId = window.setTimeout(() => {
      finish({ event: "TIMEOUT" });
    }, timeoutMs);

    window.addEventListener("message", handleMessage);
  });
}

export function AdminServiceModerationBoard() {
  const [services, setServices] = useState<DummyService[]>([]);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetchPendingServices()
      .then((items) => {
        if (cancelled) {
          return;
        }

        startTransition(() => {
          setServices(items);
        });
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        startTransition(() => {
          setServices([]);
        });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function review(serviceId: string, action: "approve" | "reject") {
    const response = await fetch(`/api/freelancer/services/${serviceId}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const payload = await response.json();
    setStatus(payload.service?.reviewNote ?? `Service ${action}d.`);
    const nextServices = await fetchPendingServices().catch(() => []);
    startTransition(() => {
      setServices(nextServices);
    });
  }

  return (
    <div className="board-list">
      {status ? <p className="helper-text">{status}</p> : null}
      {services.map((service) => (
        <article className="lead-row" key={service.id}>
          <div className="status-row">
            <span className="meta-pill">{service.status}</span>
            <span className="meta-pill">{service.category}</span>
          </div>
          <h3>{service.title}</h3>
          <p>{service.summary}</p>
          <p>
            <strong>SEO:</strong> {service.seoTitle}
          </p>
          <div className="freelancer-action-grid">
            <button className="freelancer-primary-button" onClick={() => review(service.id, "approve")} type="button">
              Approve
            </button>
            <button className="freelancer-secondary-button" onClick={() => review(service.id, "reject")} type="button">
              Reject
            </button>
          </div>
        </article>
      ))}
      {!services.length ? <p className="muted-copy">No pending services are waiting for admin moderation right now.</p> : null}
    </div>
  );
}

export function AdminWhatsAppConnectionCard({
  tenantId,
  linkHref,
  title = "WhatsApp Setup",
  fallbackPhoneNumber,
  initialConnection = null,
}: {
  tenantId?: string;
  linkHref?: string | null;
  title?: string;
  fallbackPhoneNumber?: string | null;
  initialConnection?: DummyWhatsAppConnectionState | null;
}) {
  const [connection, setConnection] = useState<DummyWhatsAppConnectionState | null>(initialConnection);
  const [isLoading, setIsLoading] = useState(!initialConnection);
  const skippedInitialPrefetchedFetchRef = useRef(Boolean(initialConnection));

  useEffect(() => {
    if (skippedInitialPrefetchedFetchRef.current) {
      skippedInitialPrefetchedFetchRef.current = false;
      return;
    }

    let cancelled = false;

    fetchWhatsAppConnection(tenantId)
      .then((nextConnection) => {
        if (cancelled) {
          return;
        }
        setConnection(nextConnection);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setConnection(initialConnection ?? null);
      })
      .finally(() => {
        if (cancelled) {
          return;
        }
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [initialConnection, tenantId]);

  if (isLoading) {
    return (
      <article className="brief-card">
        <span className="meta-pill">Loading</span>
        <strong>WhatsApp API status</strong>
        <p className="muted-copy">Loading the saved WhatsApp setup snapshot.</p>
      </article>
    );
  }

  if (!connection) {
    return (
      <article className="brief-card">
        <span className="meta-pill">Unavailable</span>
        <strong>WhatsApp API status</strong>
        <p className="muted-copy">We could not load the saved WhatsApp connection state right now.</p>
        <Link className="secondary-button" href="/admin/integrations">
          Open integrations
        </Link>
      </article>
    );
  }

  const connectedLineNumber = getVisibleWhatsAppLineNumber(connection);

  return (
    <article className="brief-card">
      <span className="meta-pill">{connection.pluginEnabled ? connection.status : "Plugin disabled"}</span>
      <strong>{title}</strong>
      <p className="muted-copy">Registered account number: {String(fallbackPhoneNumber ?? "").trim() || "Not saved"}</p>
      <p className="muted-copy">Connected WhatsApp line: {connectedLineNumber || "Not connected yet"}</p>
      <p className="muted-copy">{connection.note}</p>
      <p className="muted-copy">Last signup launch: {formatLaunchTime(connection.lastLaunchAt)}</p>
      <p className="muted-copy">Webhook: {getWhatsAppWebhookUrl(connection)}</p>
      {linkHref === null ? null : (
        <Link className="secondary-button" href={linkHref ?? (connection.pluginEnabled ? "/admin/integrations/whatsapp" : "/admin/integrations")}>
          {connection.pluginEnabled ? "Open API setup" : "Open integrations"}
        </Link>
      )}
    </article>
  );
}

export function AdminWhatsAppSetupPanel({
  tenantId,
  tenantOptions,
  fallbackPhoneNumber,
  initialConnection = null,
  variant = "full",
  settingsHref = "/admin/settings/whatsapp",
}: {
  tenantId?: string;
  tenantOptions?: WhatsAppTenantOption[];
  fallbackPhoneNumber?: string | null;
  initialConnection?: DummyWhatsAppConnectionState | null;
  variant?: "compact" | "full";
  settingsHref?: string | null;
}) {
  const router = useRouter();
  const initialTenantId = tenantId ?? tenantOptions?.[0]?.id ?? "";
  const [selectedTenantId, setSelectedTenantId] = useState(tenantId ?? tenantOptions?.[0]?.id ?? "");
  const [connection, setConnection] = useState<DummyWhatsAppConnectionState | null>(initialConnection);
  const [isLoadingConnection, setIsLoadingConnection] = useState(!initialConnection);
  const [status, setStatus] = useState<string | null>(null);
  const [hasMounted, setHasMounted] = useState(false);
  const [setupProgress, setSetupProgress] = useState<WhatsAppSetupProgress>("idle");
  const [isSaving, setIsSaving] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);
  const [isFacebookSdkReady, setIsFacebookSdkReady] = useState(false);
  const [isRefreshingToken, setIsRefreshingToken] = useState(false);
  const [isRefreshingLineStatus, setIsRefreshingLineStatus] = useState(false);
  const [isSubscribingWebhook, setIsSubscribingWebhook] = useState(false);
  const [isRegisteringPhone, setIsRegisteringPhone] = useState(false);
  const [showAdvancedDebug, setShowAdvancedDebug] = useState(false);
  const [manualDrafts, setManualDrafts] = useState<WhatsAppManualDrafts>(() => buildManualWhatsAppDrafts(initialConnection));
  const [registrationPin, setRegistrationPin] = useState("");
  const [testRecipient, setTestRecipient] = useState("");
  const [testMessage, setTestMessage] = useState("Hello from Gigxomi live webhook setup.");
  const connectionRef = useRef<DummyWhatsAppConnectionState | null>(initialConnection);
  const skippedInitialPrefetchedFetchRef = useRef(Boolean(initialConnection));
  const activeTenantId = selectedTenantId || tenantId || "";

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    let cancelled = false;

    ensureFacebookSdkLoaded()
      .then(() => {
        if (!cancelled) {
          setIsFacebookSdkReady(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setIsFacebookSdkReady(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (skippedInitialPrefetchedFetchRef.current && activeTenantId === initialTenantId) {
      skippedInitialPrefetchedFetchRef.current = false;
      return;
    }

    let cancelled = false;

    fetchWhatsAppConnection(activeTenantId || undefined)
      .then((nextConnection) => {
        if (cancelled) {
          return;
        }
        connectionRef.current = nextConnection;
        setConnection(nextConnection);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        connectionRef.current = null;
        setConnection(initialConnection);
      })
      .finally(() => {
        if (cancelled) {
          return;
        }
        setIsLoadingConnection(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeTenantId, initialConnection, initialTenantId]);

  useEffect(() => {
    setManualDrafts(buildManualWhatsAppDrafts(connection));
  }, [connection]);

  async function persistConnection(
    updates: Partial<
      Pick<
        DummyWhatsAppConnectionState,
        | "businessName"
        | "displayName"
        | "phoneNumber"
        | "paymentsEnabled"
        | "paymentsGateway"
        | "paymentsConfigurationName"
        | "paymentsTemplateName"
        | "subscriptionPaymentTemplateName"
        | "subscriptionPaymentTemplateLanguage"
        | "renewalReminderTemplateName"
        | "renewalReminderTemplateLanguage"
        | "otpTemplateName"
        | "otpTemplateLanguage"
        | "status"
        | "note"
        | "metaAppId"
        | "metaConfigId"
        | "sessionInfoVersion"
        | "embeddedSignupVersion"
        | "verifyToken"
        | "publicBaseUrl"
        | "graphApiVersion"
        | "businessId"
        | "businessPortfolioId"
        | "wabaId"
        | "phoneNumberId"
        | "systemUserId"
        | "authorizationCode"
        | "accessToken"
        | "lastLaunchAt"
        | "lastInboundAt"
        | "lastOutboundAt"
        | "lastError"
        | "lastSignupEvent"
        | "lastSignupEventAt"
      >
    >,
    nextStatusMessage?: string,
    options?: {
      manualOverrides?: Partial<DummyWhatsAppManualOverrides>;
    },
  ) {
    setIsSaving(true);
    const currentConnection = connectionRef.current;
    const nextPhoneNumberId =
      updates.phoneNumberId !== undefined
        ? updates.phoneNumberId.trim()
        : currentConnection?.phoneNumberId?.trim() || "";
    const nextWabaId = updates.wabaId !== undefined ? updates.wabaId.trim() : currentConnection?.wabaId?.trim() || "";
    const nextBusinessId = updates.businessId !== undefined ? updates.businessId.trim() : currentConnection?.businessId?.trim() || "";
    const nextBusinessPortfolioId =
      updates.businessPortfolioId !== undefined
        ? updates.businessPortfolioId.trim()
        : currentConnection?.businessPortfolioId?.trim() || "";

    if (isSuspiciousPhoneNumberId(nextPhoneNumberId, [nextWabaId, nextBusinessId, nextBusinessPortfolioId])) {
      setStatus("Phone number ID cannot match the Meta business, portfolio, or WABA ID. Save the real WhatsApp phone number ID.");
      setIsSaving(false);
      return false;
    }

    const next = {
      tenantId: activeTenantId || undefined,
      businessName: updates.businessName ?? currentConnection?.businessName,
      displayName: updates.displayName ?? currentConnection?.displayName,
      phoneNumber: updates.phoneNumber ?? currentConnection?.phoneNumber,
      paymentsEnabled: updates.paymentsEnabled ?? currentConnection?.paymentsEnabled,
      paymentsGateway: updates.paymentsGateway ?? currentConnection?.paymentsGateway,
      paymentsConfigurationName: updates.paymentsConfigurationName ?? currentConnection?.paymentsConfigurationName,
      paymentsTemplateName: updates.paymentsTemplateName ?? currentConnection?.paymentsTemplateName,
      subscriptionPaymentTemplateName: updates.subscriptionPaymentTemplateName ?? currentConnection?.subscriptionPaymentTemplateName,
      subscriptionPaymentTemplateLanguage:
        updates.subscriptionPaymentTemplateLanguage ?? currentConnection?.subscriptionPaymentTemplateLanguage,
      renewalReminderTemplateName: updates.renewalReminderTemplateName ?? currentConnection?.renewalReminderTemplateName,
      renewalReminderTemplateLanguage:
        updates.renewalReminderTemplateLanguage ?? currentConnection?.renewalReminderTemplateLanguage,
      otpTemplateName: updates.otpTemplateName ?? currentConnection?.otpTemplateName,
      otpTemplateLanguage: updates.otpTemplateLanguage ?? currentConnection?.otpTemplateLanguage,
      status: updates.status ?? currentConnection?.status,
      note: updates.note ?? currentConnection?.note,
      metaAppId: updates.metaAppId ?? currentConnection?.metaAppId,
      metaConfigId: updates.metaConfigId ?? currentConnection?.metaConfigId,
      sessionInfoVersion: updates.sessionInfoVersion ?? currentConnection?.sessionInfoVersion,
      embeddedSignupVersion: updates.embeddedSignupVersion ?? currentConnection?.embeddedSignupVersion,
      verifyToken: updates.verifyToken ?? currentConnection?.verifyToken,
      publicBaseUrl: updates.publicBaseUrl ?? currentConnection?.publicBaseUrl,
      graphApiVersion: updates.graphApiVersion ?? currentConnection?.graphApiVersion,
      businessId: updates.businessId ?? currentConnection?.businessId,
      businessPortfolioId: updates.businessPortfolioId ?? currentConnection?.businessPortfolioId,
      wabaId: updates.wabaId ?? currentConnection?.wabaId,
      phoneNumberId: updates.phoneNumberId ?? currentConnection?.phoneNumberId,
      systemUserId: updates.systemUserId ?? currentConnection?.systemUserId,
      authorizationCode: updates.authorizationCode ?? currentConnection?.authorizationCode,
      accessToken: updates.accessToken ?? currentConnection?.accessToken,
      lastLaunchAt: updates.lastLaunchAt ?? currentConnection?.lastLaunchAt,
      lastInboundAt: updates.lastInboundAt ?? currentConnection?.lastInboundAt,
      lastOutboundAt: updates.lastOutboundAt ?? currentConnection?.lastOutboundAt,
      lastError: updates.lastError ?? currentConnection?.lastError,
      lastSignupEvent: updates.lastSignupEvent ?? currentConnection?.lastSignupEvent,
      lastSignupEventAt: updates.lastSignupEventAt ?? currentConnection?.lastSignupEventAt,
      manualOverrides: options?.manualOverrides,
    };

    try {
      const response = await fetch("/api/admin/whatsapp", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.ok === false) {
        setStatus(payload.error ?? "Unable to save the WhatsApp setup right now.");
        return false;
      }

      connectionRef.current = (payload.connection ?? null) as DummyWhatsAppConnectionState | null;
      setConnection(connectionRef.current);
      setStatus(nextStatusMessage ?? "WhatsApp setup saved.");
      return true;
    } finally {
      setIsSaving(false);
    }
  }

  async function updateField(
    key:
      | "status"
      | "note"
      | "verifyToken"
      | "publicBaseUrl"
      | "graphApiVersion"
      | "authorizationCode"
      | "accessToken"
      | "paymentsGateway"
      | "paymentsConfigurationName"
      | "paymentsTemplateName"
      | "subscriptionPaymentTemplateName"
      | "subscriptionPaymentTemplateLanguage"
      | "renewalReminderTemplateName"
      | "renewalReminderTemplateLanguage"
      | "otpTemplateName"
      | "otpTemplateLanguage",
    value: string,
  ) {
    await persistConnection({ [key]: value });
  }

  function updateManualDraft(key: DummyWhatsAppManualOverrideKey, value: string) {
    setManualDrafts((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function saveManualOverrides() {
    const nextPhoneNumberId = manualDrafts.phoneNumberId.trim();
    const nextWabaId = manualDrafts.wabaId.trim();
    const nextBusinessId = manualDrafts.businessId.trim();
    const nextBusinessPortfolioId = manualDrafts.businessPortfolioId.trim();

    if (isSuspiciousPhoneNumberId(nextPhoneNumberId, [nextWabaId, nextBusinessId, nextBusinessPortfolioId])) {
      setStatus("Phone number ID cannot match the Meta business, portfolio, or WABA ID. Save the real WhatsApp phone number ID.");
      return;
    }

    const nextManualOverrides = DUMMY_WHATSAPP_MANUAL_OVERRIDE_KEYS.reduce<Partial<DummyWhatsAppManualOverrides>>((accumulator, key) => {
      accumulator[key] = Boolean(manualDrafts[key].trim());
      return accumulator;
    }, {});

    await persistConnection(
      {
        businessName: manualDrafts.businessName,
        displayName: manualDrafts.displayName,
        phoneNumber: manualDrafts.phoneNumber,
        businessId: manualDrafts.businessId,
        businessPortfolioId: manualDrafts.businessPortfolioId,
        wabaId: manualDrafts.wabaId,
        phoneNumberId: manualDrafts.phoneNumberId,
        systemUserId: manualDrafts.systemUserId,
      },
      "Manual WhatsApp line values saved. AI Closer will keep these values during refresh until you switch back to Meta-detected values.",
      {
        manualOverrides: nextManualOverrides,
      },
    );
  }

  async function clearManualOverrides() {
    const clearedOverrides = DUMMY_WHATSAPP_MANUAL_OVERRIDE_KEYS.reduce<Partial<DummyWhatsAppManualOverrides>>((accumulator, key) => {
      accumulator[key] = false;
      return accumulator;
    }, {});

    const saved = await persistConnection(
      {},
      "Manual WhatsApp line overrides cleared. AI Closer will now refresh the Meta-detected values for this tenant.",
      { manualOverrides: clearedOverrides },
    );

    if (!saved) {
      return;
    }

    const nextConnection = await refreshLineStatus({ silent: true });
    if (nextConnection) {
      setStatus("Manual overrides cleared. AI Closer refreshed the live Meta values for this tenant.");
    }
  }

  async function confirmConnectionAfterSignup(baseConnection: DummyWhatsAppConnectionState | null) {
    let latestConnection = baseConnection;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      if (hasUsableWhatsAppLine(latestConnection)) {
        return latestConnection;
      }

      if (!hasWhatsAppToken(latestConnection) && !latestConnection?.authorizationCode.trim()) {
        return latestConnection;
      }

      await new Promise((resolve) => window.setTimeout(resolve, 900));
      const refreshedConnection = await fetchWhatsAppConnection(activeTenantId || undefined, { sync: true }).catch(() => null);
      if (!refreshedConnection) {
        continue;
      }

      latestConnection = refreshedConnection;
      connectionRef.current = refreshedConnection;
      setConnection(refreshedConnection);
    }

    return latestConnection;
  }

  async function refreshAfterConnected(baseConnection: DummyWhatsAppConnectionState | null) {
    setSetupProgress("refreshing");
    let latestConnection = baseConnection;
    if (latestConnection) {
      connectionRef.current = latestConnection;
      setConnection(latestConnection);
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
      if (hasUsableWhatsAppLine(latestConnection)) {
        break;
      }

      await new Promise((resolve) => window.setTimeout(resolve, 600));
      const refreshedConnection = await fetchWhatsAppConnection(activeTenantId || undefined, { sync: true }).catch(() => null);
      if (!refreshedConnection) {
        continue;
      }
      latestConnection = refreshedConnection;
      connectionRef.current = refreshedConnection;
      setConnection(refreshedConnection);
    }

    if (hasUsableWhatsAppLine(latestConnection)) {
      setSetupProgress("connected");
      setStatus("WhatsApp is connected. Refresh the page if the latest line does not appear immediately.");
      router.refresh();
    } else {
      setSetupProgress("pending");
      setStatus("Meta signup finished, but Gigxomi could not read the latest connected line yet. Refresh the page once or open WhatsApp settings to retry line status.");
    }

    return latestConnection;
  }

  async function finalizeEmbeddedSignup(
    result: MetaEmbeddedSignupSignal,
    payload: Record<string, unknown>,
    latestConnection: DummyWhatsAppConnectionState,
    capturedAt: string,
  ) {
    setIsSaving(true);
    setSetupProgress("exchanging");

    try {
      const response = await fetch("/api/admin/whatsapp/finalize-signup", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: activeTenantId || undefined,
          businessId: pickMetaText(payload.business_id, payload.businessId),
          businessPortfolioId: pickMetaText(payload.business_portfolio_id, payload.businessPortfolioId, payload.business_manager_id, payload.businessManagerId),
          wabaId: pickMetaText(payload.waba_id, payload.wabaId, payload.whatsapp_business_account_id, payload.whatsappBusinessAccountId),
          phoneNumberId: pickMetaText(payload.phone_number_id, payload.phoneNumberId),
          systemUserId: pickMetaText(payload.system_user_id, payload.systemUserId) || latestConnection.systemUserId,
          authorizationCode: result.code ?? pickMetaText(payload.code, payload.authorization_code, payload.authorizationCode) ?? latestConnection.authorizationCode,
          accessToken: result.accessToken ?? pickMetaText(payload.access_token, payload.accessToken) ?? latestConnection.accessToken,
          registrationPin: registrationPin.trim(),
          displayName: pickMetaText(payload.display_name, payload.displayName) || latestConnection.displayName,
          businessName: pickMetaText(payload.business_name, payload.businessName) || latestConnection.businessName,
          phoneNumber: pickMetaText(payload.display_phone_number, payload.phone_number, payload.phoneNumber),
          lastSignupEvent: result.event,
          lastSignupEventAt: capturedAt,
          signupPayload: payload,
          signupSignal: result,
        }),
      });

      const responsePayload = (await response.json().catch(() => ({}))) as WhatsAppFinalizeSignupResponse;
      logWhatsAppOnboardingStep("FINALIZE_SIGNUP_RESPONSE", {
        status: response.status,
        ok: response.ok,
        payload: responsePayload,
      });

      const savedConnection = (responsePayload.connection ?? null) as DummyWhatsAppConnectionState | null;
      connectionRef.current = savedConnection;
      setConnection(savedConnection);

      const errorMessage =
        responsePayload.error ??
        responsePayload.exchangeError ??
        responsePayload.summaryError ??
        responsePayload.registrationError ??
        responsePayload.subscriptionError ??
        "";

      if (!response.ok || responsePayload.ok === false) {
        setSetupProgress(responsePayload.registrationError ? "pending" : "error");
        setStatus(errorMessage || "Meta signup returned data, but Gigxomi could not finish the WhatsApp setup.");
        return false;
      }

      setSetupProgress("registering");
      const nextConnection = await confirmConnectionAfterSignup(savedConnection);

      if (responsePayload.subscriptionError) {
        setSetupProgress("pending");
        setStatus(`Meta signup captured the official line, but webhook subscription still needs attention: ${responsePayload.subscriptionError}`);
      } else if (nextConnection?.phoneNumberId?.trim()) {
        setRegistrationPin("");
        setSetupProgress("subscribing");
        await refreshAfterConnected(nextConnection);
      } else if (nextConnection?.wabaId?.trim()) {
        setSetupProgress("pending");
        setStatus("Meta signup returned the business/WABA details. Gigxomi is now waiting for Meta to return the Cloud API phone number ID before registration can start.");
      } else {
        setSetupProgress("pending");
        setStatus("Meta signup finished, but Gigxomi did not receive the authorization code, WABA ID, or Cloud API phone number ID yet. Check the Meta OAuth/JSSDK setup and rerun signup.");
      }

      return true;
    } finally {
      setIsSaving(false);
    }
  }

  function launchEmbeddedSignupPopup(latestConnection: DummyWhatsAppConnectionState) {
    const facebookSdk = typeof window !== "undefined" ? window.FB : undefined;
    const appId = latestConnection.metaAppId.trim() || META_EMBEDDED_SIGNUP_APP_ID;
    const configId = latestConnection.metaConfigId.trim() || META_EMBEDDED_SIGNUP_CONFIG_ID;
    const graphVersion = latestConnection.graphApiVersion.trim() || "v25.0";

    if (!facebookSdk) {
      throw new Error("Meta popup engine is still loading. Try Connect WhatsApp again in a moment.");
    }

    if (!appId || !configId) {
      throw new Error("Meta app ID or config ID is missing. Save the production Embedded Signup config first.");
    }

    facebookSdk.init({
      appId,
      autoLogAppEvents: true,
      xfbml: true,
      version: graphVersion,
    });

    const signalPromise = waitForMetaEmbeddedSignupSignal(null, 1000 * 60 * 8, META_SIGNUP_CODE_FALLBACK_MS);
    return new Promise<MetaEmbeddedSignupSignal>((resolve) => {
      let settled = false;
      let sessionSignal: MetaEmbeddedSignupSignal | null = null;
      let authSignal: MetaEmbeddedSignupSignal | null = null;
      let sessionFallbackTimer: number | null = null;
      let authFallbackTimer: number | null = null;

      const finish = (signal: MetaEmbeddedSignupSignal) => {
        if (settled) {
          return;
        }

        settled = true;
        if (sessionFallbackTimer) {
          window.clearTimeout(sessionFallbackTimer);
        }
        if (authFallbackTimer) {
          window.clearTimeout(authFallbackTimer);
        }
        resolve(signal);
      };

      const finishWithBestSignal = () => {
        if (settled) {
          return;
        }

        const merged = authSignal ? mergeSignupSignals(authSignal, sessionSignal) : sessionSignal;
        if (!merged) {
          return;
        }

        finish(merged);
      };

      const scheduleSessionFallback = () => {
        if (sessionFallbackTimer || settled) {
          return;
        }

        sessionFallbackTimer = window.setTimeout(() => {
          finishWithBestSignal();
        }, META_SIGNUP_CODE_FALLBACK_MS);
      };

      const scheduleAuthFallback = () => {
        if (authFallbackTimer || settled) {
          return;
        }

        authFallbackTimer = window.setTimeout(() => {
          finishWithBestSignal();
        }, 8000);
      };

      signalPromise
        .then((signal) => {
          if (settled) {
            return;
          }

          sessionSignal = signal;
          logWhatsAppOnboardingStep("STEP_2_POSTMESSAGE_RECEIVED", {
            source: "embedded_signup_signal",
            parsed: signal,
          });
          if (signal.event === "FINISH") {
            logWhatsAppOnboardingStep("META_FINISH_RECEIVED", {
              source: "embedded_signup_signal",
              parsed: signal,
            });
          }

          if (signal.event === "ERROR") {
            finishWithBestSignal();
            return;
          }

          if (signal.code || signal.accessToken || authSignal?.code || authSignal?.accessToken) {
            finishWithBestSignal();
            return;
          }

          if (signal.event === "FINISH" || signal.event === "TOKEN" || signal.event === "CODE") {
            scheduleSessionFallback();
          }
        })
        .catch(() => undefined);

      facebookSdk.login(
        (response) => {
          if (settled) {
            return;
          }

          const code = pickMetaText(response.authResponse?.code);
          const accessToken = pickMetaText(response.authResponse?.accessToken);
          if (code) {
            logWhatsAppOnboardingStep("STEP_3_AUTH_CODE_RECEIVED", { code, response });
            logWhatsAppOnboardingStep("META_AUTH_CODE_RECEIVED", { code, response });
          }
          authSignal = {
            event: accessToken ? "TOKEN" : code ? "CODE" : "CANCEL",
            code: code || undefined,
            accessToken: accessToken || undefined,
          };

          if (!code && !accessToken) {
            scheduleAuthFallback();
            return;
          }

          if (sessionSignal) {
            finishWithBestSignal();
            return;
          }

          scheduleAuthFallback();
        },
        {
          config_id: configId,
          response_type: "code",
          override_default_response_type: true,
          extras: buildEmbeddedSignupExtras(latestConnection),
        },
      );
      logWhatsAppOnboardingStep("STEP_1_POPUP_OPENED", {
        appId,
        configId,
        graphVersion,
        options: {
          config_id: configId,
          response_type: "code",
          override_default_response_type: true,
          extras: buildEmbeddedSignupExtras(latestConnection),
        },
      });
    });
  }

  async function handleLaunch(mode: "popup" | "tab") {
    if (!connection) {
      return;
    }

    const launchAt = new Date().toISOString();
    setIsLaunching(true);
    setSetupProgress("opening");
    try {
      try {
        localStorage.removeItem(META_SIGNUP_STORAGE_KEY);
      } catch {
        // Ignore storage cleanup errors and continue with the launch.
      }

      let resultPromise: Promise<MetaEmbeddedSignupSignal>;
      if (mode === "popup") {
        if (isFacebookSdkReady) {
          resultPromise = launchEmbeddedSignupPopup(connection);
        } else {
          const fallbackPopup = window.open(buildEmbeddedSignupUrl(connection), "_blank", "popup,width=1040,height=760");
          if (!fallbackPopup) {
            setStatus("Your browser blocked the Meta signup popup. Allow popups for this site, then try Connect WhatsApp again.");
            return;
          }

          resultPromise = waitForMetaEmbeddedSignupSignal(fallbackPopup).catch(() => ({ event: "TIMEOUT" } as MetaEmbeddedSignupSignal));
        }
      } else {
        const fallbackPopup = window.open(buildEmbeddedSignupUrl(connection), "_blank");
        if (!fallbackPopup) {
          setStatus("Your browser blocked the fallback tab. Use the in-app popup or allow popups for this site.");
          return;
        }

        resultPromise = waitForMetaEmbeddedSignupSignal(fallbackPopup).catch(() => ({ event: "TIMEOUT" } as MetaEmbeddedSignupSignal));
      }

      await persistConnection(
        {
          status: connection.status === "Not started" ? "Onboarding in progress" : connection.status,
          lastLaunchAt: launchAt,
          lastError: "",
          lastSignupEvent: "",
          lastSignupEventAt: launchAt,
          note:
            connection.status === "Not started"
              ? "Meta signup launched. Finish the popup and AI Closer will auto-capture the returned IDs when Meta sends them back."
              : connection.note,
        },
        "Meta WhatsApp signup opened. Finish the flow in Meta and AI Closer will capture the returned IDs automatically.",
      );

      setSetupProgress("waiting");
      const result = await resultPromise;

      const capturedAt = new Date().toISOString();
      const latestConnection = connectionRef.current ?? connection;
      const payload = result.data ?? {};
      const errorMessage = pickMetaText(payload.error_message, payload.errorMessage, payload.message, payload.current_step);

      if (result.event === "FINISH") {
        await finalizeEmbeddedSignup(result, payload, latestConnection, capturedAt);
        return;
      }

      if (result.event === "TOKEN") {
        await finalizeEmbeddedSignup(result, payload, latestConnection, capturedAt);
        return;
      }

      if (result.event === "CODE") {
        await finalizeEmbeddedSignup(result, payload, latestConnection, capturedAt);
        return;
      }

      if (result.event === "ERROR") {
        setSetupProgress("error");
        await persistConnection(
          {
            lastError: errorMessage || "Meta signup reported an error.",
            lastSignupEvent: result.event,
            lastSignupEventAt: capturedAt,
            note: "Meta signup returned an error. Review the popup response and the Facebook Login for Business configuration.",
          },
          errorMessage || "Meta signup returned an error.",
        );
        return;
      }

      if (result.event === "CANCEL") {
        setSetupProgress("idle");
        await persistConnection(
          {
            lastError: "",
            lastSignupEvent: result.event,
            lastSignupEventAt: capturedAt,
            note: "Meta signup popup closed before AI Closer received the final onboarding payload.",
          },
          "Meta signup was closed before the final onboarding payload reached AI Closer.",
        );
        return;
      }

      setSetupProgress("error");
      await persistConnection(
        {
          lastError: "Meta signup timed out before the browser returned onboarding data.",
          lastSignupEvent: result.event,
          lastSignupEventAt: capturedAt,
          note: "No onboarding payload came back from Meta. Check the popup completion, Allowed Domains, and Valid OAuth Redirect URIs in Facebook Login for Business.",
        },
        "Meta popup closed without returning setup data. Check Allowed Domains and Valid OAuth Redirect URIs in Facebook Login for Business.",
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to complete the Meta signup handshake.";
      setSetupProgress("error");
      setStatus(`${message} Check the production Meta app domains, redirect URI, app secret, and Embedded Signup configuration for AI Closer.`);
    } finally {
      setIsLaunching(false);
    }
  }

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(connection ? buildEmbeddedSignupUrl(connection) : META_WHATSAPP_ONBOARDING_URL);
      setStatus("Meta onboarding link copied.");
    } catch {
      setStatus("Copy failed in this browser. Use the open buttons instead.");
    }
  }

  async function handleCopyValue(value: string, label: string) {
    if (!value.trim()) {
      setStatus(`${label} is empty right now.`);
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      setStatus(`${label} copied.`);
    } catch {
      setStatus(`Unable to copy ${label.toLowerCase()} in this browser.`);
    }
  }

  async function handleSendTestMessage() {
    if (!testRecipient.trim() || !testMessage.trim()) {
      setStatus("Add a recipient number and a test message before sending.");
      return;
    }

    const response = await fetch("/api/meta/whatsapp/messages", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenantId: activeTenantId || undefined,
        to: testRecipient,
        body: testMessage,
      }),
    });

    const payload = await response.json();
    const refreshedConnection = await fetchWhatsAppConnection(activeTenantId || undefined).catch(() => null);
    connectionRef.current = refreshedConnection;
    setConnection(refreshedConnection);

    if (!response.ok || !payload.ok) {
      const errorMessage = String(payload.error ?? "WhatsApp test send failed.");
      if (isAccountNotRegisteredError(errorMessage)) {
        setStatus(
          "This WhatsApp number is connected in Meta but is not fully registered for Cloud API sending yet. Use Refresh line status after Meta activates the line, or reconnect WhatsApp if you need to rerun signup for this number.",
        );
        return;
      }

      setStatus(errorMessage);
      return;
    }

    setStatus(
      payload.mode === "local-only"
        ? payload.error || "Test send stayed local because the WhatsApp line is not fully ready for Cloud API sending yet."
        : "Test message sent through the WhatsApp Cloud API.",
    );
  }

  async function refreshLineStatus(options?: { silent?: boolean }) {
    setIsRefreshingLineStatus(true);

    try {
      const nextConnection = await fetchWhatsAppConnection(activeTenantId || undefined, { sync: true });
      connectionRef.current = nextConnection;
      setConnection(nextConnection);

      if (nextConnection && hasWhatsAppToken(nextConnection) && nextConnection.phoneNumberId.trim()) {
        const activated = await registerPhoneNumberForCloudApi({ silent: true });
        if (activated) {
          return connectionRef.current;
        }
      }

      if (!options?.silent) {
        if (!nextConnection) {
          setStatus("Unable to load the latest WhatsApp line status for this tenant.");
        } else if (isAccountNotRegisteredError(nextConnection.lastError)) {
          setStatus(
            "Gigxomi refreshed the live Meta status. The number is connected, but Meta still has not fully registered it for Cloud API sending yet. Finish the number registration step in Meta, then retry or reconnect.",
          );
        } else if (nextConnection.phoneNumberId.trim() && hasWhatsAppToken(nextConnection)) {
          setStatus("Gigxomi refreshed the live Meta line details for this tenant.");
        } else {
          setStatus(nextConnection.note || "Gigxomi refreshed the live Meta line details.");
        }
      }

      return nextConnection;
    } catch {
      if (!options?.silent) {
        setStatus("Unable to refresh the live WhatsApp line status right now.");
      }
      return null;
    } finally {
      setIsRefreshingLineStatus(false);
    }
  }

  async function refreshAccessToken(options?: { silent?: boolean }) {
    setIsRefreshingToken(true);

    try {
      const response = await fetch("/api/admin/whatsapp/refresh-token", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: activeTenantId || undefined }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        connection?: DummyWhatsAppConnectionState | null;
        debugExpiresAt?: string | null;
        subscriptionError?: string | null;
      };

      const nextConnection = (payload.connection ?? null) as DummyWhatsAppConnectionState | null;
      connectionRef.current = nextConnection;
      setConnection(nextConnection);

      if (!response.ok || payload.ok === false) {
        if (!options?.silent) {
          setStatus(payload.error ?? "Unable to refresh the Meta access token right now.");
        }
        return false;
      }

      if (!options?.silent) {
        setStatus(
          payload.subscriptionError
            ? `Meta token refreshed, but webhook subscription still needs attention: ${payload.subscriptionError}`
            : payload.debugExpiresAt
              ? `Meta access token refreshed successfully. Debug expiry: ${payload.debugExpiresAt}.`
              : "Meta access token refreshed successfully.",
        );
      }

      return true;
    } finally {
      setIsRefreshingToken(false);
    }
  }

  async function subscribeWebhookApp(options?: { silent?: boolean }) {
    setIsSubscribingWebhook(true);

    try {
      const response = await fetch("/api/admin/whatsapp/subscribe-webhook", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: activeTenantId || undefined }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        connection?: DummyWhatsAppConnectionState | null;
      };

      const nextConnection = (payload.connection ?? null) as DummyWhatsAppConnectionState | null;
      connectionRef.current = nextConnection;
      setConnection(nextConnection);

      if (!response.ok || payload.ok === false) {
        if (!options?.silent) {
          setStatus(payload.error ?? "Unable to subscribe the Meta app to this WhatsApp Business Account right now.");
        }
        return false;
      }

      if (!options?.silent) {
        setStatus("Webhook app subscription confirmed. Inbound WhatsApp messages should now reach Gigxomi.");
      }

      return true;
    } finally {
      setIsSubscribingWebhook(false);
    }
  }

  async function registerPhoneNumberForCloudApi(options?: { silent?: boolean }) {
    const normalizedPin = registrationPin.trim();
    if (normalizedPin && !/^\d{6}$/.test(normalizedPin)) {
      if (!options?.silent) {
        setStatus("Enter a valid 6-digit PIN, or leave the field blank to let Gigxomi attempt Meta registration without one.");
      }
      return false;
    }

    setIsRegisteringPhone(true);
    if (!options?.silent) {
      setStatus(null);
    }
    setSetupProgress("registering");
    logWhatsAppOnboardingStep("REGISTER_PHONE_REQUEST", {
      source: "button_click",
      tenantId: activeTenantId || undefined,
      hasAccessToken: hasWhatsAppToken(connectionRef.current),
      hasPhoneNumberId: Boolean(connectionRef.current?.phoneNumberId?.trim()),
      phoneNumberId: connectionRef.current?.phoneNumberId,
      hasPin: Boolean(normalizedPin),
      silent: Boolean(options?.silent),
    });
    try {
      const response = await fetch("/api/admin/whatsapp/register-phone", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: activeTenantId || undefined,
          registrationPin: normalizedPin,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        metaRegistrationResponse?: unknown;
        subscriptionError?: string | null;
        connection?: DummyWhatsAppConnectionState | null;
      };
      logWhatsAppOnboardingStep("REGISTER_PHONE_RESPONSE", {
        source: "button_click",
        status: response.status,
        ok: response.ok,
        payload,
      });

      const nextConnection = (payload.connection ?? null) as DummyWhatsAppConnectionState | null;
      connectionRef.current = nextConnection;
      setConnection(nextConnection);

      if (!response.ok || payload.ok === false) {
        setSetupProgress("pending");
        logWhatsAppOnboardingStep("REGISTER_PHONE_FAILED", {
          source: "button_click",
          status: response.status,
          error: payload.error,
          metaRegistrationResponse: payload.metaRegistrationResponse,
        });
        if (!options?.silent) {
          setStatus(payload.error ?? "Meta could not register this phone number for Cloud API sending.");
        }
        return false;
      }

      setRegistrationPin("");
      logWhatsAppOnboardingStep("REGISTER_PHONE_SUCCESS", {
        source: "button_click",
        metaRegistrationResponse: payload.metaRegistrationResponse,
        subscriptionError: payload.subscriptionError,
        connection: nextConnection,
      });
      if (payload.subscriptionError) {
        setSetupProgress("pending");
        if (!options?.silent) {
          setStatus(`WhatsApp line was saved, but webhook subscription still needs attention: ${payload.subscriptionError}`);
        }
      } else {
        await refreshAfterConnected(nextConnection);
      }
      return true;
    } finally {
      setIsRegisteringPhone(false);
    }
  }

  if (!hasMounted || isLoadingConnection) {
    return (
      <article className="brief-card">
        <span className="meta-pill">Loading</span>
        <strong>WhatsApp setup</strong>
        <p className="muted-copy">Opening the saved tenant configuration before any optional Meta refresh work.</p>
      </article>
    );
  }

  if (!connection) {
    return (
      <article className="brief-card">
        <span className="meta-pill">Loading</span>
        <strong>Preparing WhatsApp setup</strong>
        <p className="muted-copy">Reload the page once if the account setup draft does not appear automatically.</p>
      </article>
    );
  }

  const webhookUrl = getWhatsAppWebhookUrl(connection);
  const selectedTenant = tenantOptions?.find((item) => item.id === activeTenantId) ?? null;
  const reconnectRecommended = shouldOfferReconnect(connection);
  const registrationPending = needsPhoneRegistrationRetry(connection);
  const registrationPinRequired =
    isRegistrationPinRequiredError(connection.lastError) || isRegistrationPinRequiredError(connection.note);
  const registrationPinLabel = registrationPinRequired
    ? "Cloud API registration PIN (required by Meta)"
    : "Cloud API registration PIN (optional)";
  const registrationPinPlaceholder = registrationPinRequired
    ? "Leave blank to use 889900"
    : "Leave blank to use default PIN when Meta asks";
  const primaryLaunchLabel = !isFacebookSdkReady
    ? "Loading Meta popup..."
    : isLaunching
      ? "Opening Meta popup..."
      : reconnectRecommended
        ? "Reconnect WhatsApp"
        : "Connect WhatsApp";
  const registeredPhoneNumber = String(selectedTenant?.phoneNumber ?? fallbackPhoneNumber ?? "").trim();
  const connectedLineNumber = getVisibleWhatsAppLineNumber(connection);
  const connectionDisplay = getWhatsAppConnectionDisplay(connection);
  const visibleProgress =
    setupProgress !== "idle"
      ? getWhatsAppSetupProgressLabel(setupProgress, connection)
      : isLoadingConnection
        ? "Loading setup"
        : isFacebookSdkReady
          ? ""
          : "Loading Meta popup";
  const setupButtonDisabled = isSaving || isLaunching || !isFacebookSdkReady;
  const manualOverrides = normalizeManualOverrides(connection.manualOverrides);
  const activeManualOverrideLabels = DUMMY_WHATSAPP_MANUAL_OVERRIDE_KEYS.filter((key) => manualOverrides[key]).map(
    (key) => WHATSAPP_MANUAL_OVERRIDE_LABELS[key],
  );

  if (variant === "compact") {
    return (
      <div className="whatsapp-setup-clean-shell">
        {tenantOptions?.length ? (
          <article className="whatsapp-setup-card">
            <span className="meta-pill">Agency</span>
            <label className="freelancer-field freelancer-field-full">
              <span>Setup WhatsApp for</span>
              <select
                onChange={(event) => {
                  setSelectedTenantId(event.target.value);
                  setIsLoadingConnection(true);
                  setStatus(null);
                  setSetupProgress("idle");
                }}
                value={activeTenantId}
              >
                {tenantOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}{option.phoneNumber ? ` - ${option.phoneNumber}` : ""}
                  </option>
                ))}
              </select>
            </label>
          </article>
        ) : null}
        <article className="whatsapp-setup-card">
          <div className="whatsapp-setup-status-row">
            <span className="meta-pill">{connectionDisplay.badge}</span>
            {visibleProgress ? (
              <span className="whatsapp-setup-progress">
                <span className="whatsapp-setup-spinner" />
                {visibleProgress}
              </span>
            ) : null}
          </div>
          <strong>{connectionDisplay.headline}</strong>
          <p className="muted-copy">{connectionDisplay.detail}</p>
          {registrationPinRequired ? (
            <div className="freelancer-form-grid">
              <label className="freelancer-field">
                <span>{registrationPinLabel}</span>
                <input
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  maxLength={6}
                  onChange={(event) => setRegistrationPin(event.target.value.replace(/\D+/g, "").slice(0, 6))}
                  placeholder={registrationPinPlaceholder}
                  type="password"
                  value={registrationPin}
                />
              </label>
              <div className="freelancer-field">
                <span>Phone registration</span>
                <button
                  className="freelancer-secondary-button"
                  disabled={isSaving || isLaunching || isRegisteringPhone || !hasWhatsAppToken(connection) || !connection.phoneNumberId.trim()}
                  onClick={() => registerPhoneNumberForCloudApi()}
                  type="button"
                >
                  {isRegisteringPhone ? "Registering phone..." : "Register with PIN"}
                </button>
              </div>
            </div>
          ) : null}
          <div className="whatsapp-setup-actions">
            <button className="freelancer-primary-button" disabled={setupButtonDisabled} onClick={() => handleLaunch("popup")} type="button">
              <MessageSquareShare size={15} strokeWidth={1.8} />
              {isLaunching || isSaving ? "Connecting..." : "Setup WhatsApp"}
            </button>
            {settingsHref ? (
              <Link className="secondary-button" href={settingsHref}>
                WhatsApp settings
              </Link>
            ) : null}
          </div>
          {status ? <p className="helper-text">{status}</p> : null}
        </article>
      </div>
    );
  }

  return (
    <div className="stack-list">
      {tenantOptions?.length ? (
        <article className="brief-card">
          <span className="meta-pill">Agency tenant</span>
          <strong>{selectedTenant?.name ?? "Select agency"}</strong>
          <div className="freelancer-form-grid">
            <label className="freelancer-field freelancer-field-full">
              <span>Manage WhatsApp setup for</span>
              <select
                onChange={(event) => {
                  setSelectedTenantId(event.target.value);
                  setIsLoadingConnection(true);
                  setStatus(null);
                  setSetupProgress("idle");
                }}
                value={activeTenantId}
              >
                {tenantOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}{option.phoneNumber ? ` - ${option.phoneNumber}` : ""}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="muted-copy">
            Each agency keeps its own WhatsApp onboarding state, phone number ID, webhook status, and token. Use embedded signup once per agency line, then Gigxomi stores the captured fields on that tenant.
          </p>
        </article>
      ) : null}

      <div className="brief-grid three-up">
        <article className="brief-card">
          <span className="meta-pill">{connection.status}</span>
          <strong>Embedded signup test</strong>
          <p className="muted-copy">The main button now uses Meta&apos;s JS SDK flow first. That is the path that can return the signup result, close cleanly, and auto-capture business IDs.</p>
        </article>
        <article className="brief-card">
          <span className="meta-pill">Last launch</span>
          <strong>{formatLaunchTime(connection.lastLaunchAt)}</strong>
          <p className="muted-copy">Use the in-app popup. Gigxomi captures the returned setup details and subscribes the webhook automatically.</p>
        </article>
        <article className="brief-card">
          <span className="meta-pill">Webhook</span>
          <strong>{webhookUrl}</strong>
          <p className="muted-copy">Gigxomi uses this callback when subscribing the Meta app after signup completes.</p>
        </article>
        <article className="brief-card">
          <span className="meta-pill">Numbers</span>
          <strong>{connectedLineNumber || "No WhatsApp line connected"}</strong>
          <p className="muted-copy">Connected WhatsApp line for this tenant. Profile/register number stays separate: {registeredPhoneNumber || "not saved"}.</p>
        </article>
      </div>

      <div className="freelancer-form-grid">
        <label className="freelancer-field">
          <span>{registrationPinLabel}</span>
          <input
            autoComplete="one-time-code"
            inputMode="numeric"
            maxLength={6}
            onChange={(event) => setRegistrationPin(event.target.value.replace(/\D+/g, "").slice(0, 6))}
            placeholder={registrationPinPlaceholder}
            type="password"
            value={registrationPin}
          />
        </label>
        <div className="freelancer-field">
          <span>Phone registration</span>
          <button
            className="freelancer-secondary-button"
            disabled={isSaving || isLaunching || isRegisteringPhone || !hasWhatsAppToken(connection) || !connection.phoneNumberId.trim()}
            onClick={() => registerPhoneNumberForCloudApi()}
            type="button"
          >
            {isRegisteringPhone ? "Registering phone..." : "Register phone number"}
          </button>
        </div>
      </div>

      <div className="freelancer-action-grid">
        <button className="freelancer-primary-button" disabled={setupButtonDisabled} onClick={() => handleLaunch("popup")} type="button">
          <MessageSquareShare size={15} strokeWidth={1.8} />
          {primaryLaunchLabel}
        </button>
        <button
          className="freelancer-secondary-button"
          disabled={isSaving || isLaunching || isRefreshingLineStatus}
          onClick={() => refreshLineStatus()}
          type="button"
        >
          {isRefreshingLineStatus ? "Refreshing line status..." : "Refresh line status"}
        </button>
        <button className="freelancer-secondary-button" onClick={() => setShowAdvancedDebug((current) => !current)} type="button">
          {showAdvancedDebug ? "Hide advanced debug" : "Show advanced debug"}
        </button>
      </div>
      {visibleProgress ? (
        <p className="helper-text">
          <span className="whatsapp-setup-spinner" /> {visibleProgress}
        </p>
      ) : null}
      <p className="muted-copy">
        AI Closer now starts the official Meta popup from inside the app. Complete the popup and AI Closer will capture the authorization code, business details, WABA, and phone number details automatically for this tenant.
      </p>
      {connectedLineNumber ? <p className="muted-copy">Current connected WhatsApp number: {connectedLineNumber}</p> : null}
      {registrationPending ? (
        <p className="helper-text">
          {registrationPinRequired
            ? "This line is connected, but Meta requires the 6-digit PIN before Cloud API phone registration can finish."
            : "This line is already connected, but Meta still reports it as not fully registered for Cloud API sending. Use Refresh line status after Meta activates the number, or Reconnect WhatsApp to rerun the signup flow for this tenant."}
        </p>
      ) : reconnectRecommended ? (
        <p className="muted-copy">
          Clicking <strong>Reconnect WhatsApp</strong> safely reruns the official Meta signup popup for the same tenant. Use it whenever the line needs a fresh authorization code or Meta needs you to complete number registration again.
        </p>
      ) : null}
      {showAdvancedDebug ? (
        <>
          <div className="freelancer-action-grid">
            <button className="freelancer-secondary-button" disabled={isSaving || isLaunching} onClick={() => handleLaunch("tab")} type="button">
              Open fallback tab
              <ExternalLink size={14} strokeWidth={1.8} />
            </button>
            <button className="freelancer-secondary-button" onClick={handleCopyLink} type="button">
              <Copy size={14} strokeWidth={1.8} />
              Copy Meta link
            </button>
            <button
              className="freelancer-secondary-button"
              disabled={isSaving || isLaunching || isRefreshingToken || !connection.authorizationCode.trim()}
              onClick={() => refreshAccessToken()}
              type="button"
            >
              {isRefreshingToken ? "Refreshing token..." : "Refresh access token"}
            </button>
            <button
              className="freelancer-secondary-button"
              disabled={isSaving || isLaunching || isSubscribingWebhook || !hasWhatsAppToken(connection) || !connection.wabaId.trim()}
              onClick={() => subscribeWebhookApp()}
              type="button"
            >
              {isSubscribingWebhook ? "Subscribing webhook..." : "Subscribe webhook app"}
            </button>
            <a className="secondary-button" href={META_WHATSAPP_ONBOARDING_URL} rel="noreferrer" target="_blank">
              Raw onboarding URL
              <ExternalLink size={14} strokeWidth={1.8} />
            </a>
          </div>
          <p className="muted-copy">
            Advanced debug is only for Meta troubleshooting. Normal agency setup should use the in-app popup, not the fallback link flow.
          </p>
        </>
      ) : null}

      {showAdvancedDebug ? (
        <>
          <article className="brief-card">
            <span className="meta-pill">{activeManualOverrideLabels.length ? "Manual override active" : "Meta detected values"}</span>
            <strong>Manual line identity override</strong>
            <p className="muted-copy">
              Save these values explicitly when you need Gigxomi to keep a manual line identity. Refresh will no longer overwrite saved manual fields until you switch back to Meta-detected values.
            </p>
            {activeManualOverrideLabels.length ? (
              <p className="muted-copy">Locked fields: {activeManualOverrideLabels.join(", ")}</p>
            ) : (
              <p className="muted-copy">No manual line identity override is active right now.</p>
            )}
            <div className="freelancer-action-grid">
              <button className="freelancer-primary-button" disabled={isSaving || isLaunching} onClick={saveManualOverrides} type="button">
                Save manual values
              </button>
              <button
                className="freelancer-secondary-button"
                disabled={isSaving || isLaunching || !activeManualOverrideLabels.length}
                onClick={clearManualOverrides}
                type="button"
              >
                Use Meta detected values
              </button>
            </div>
          </article>
          <div className="freelancer-form-grid">
            <label className="freelancer-field">
              <span>Business name {manualOverrides.businessName ? "(Manual override)" : ""}</span>
              <input onChange={(event) => updateManualDraft("businessName", event.target.value)} value={manualDrafts.businessName} />
            </label>
            <label className="freelancer-field">
              <span>Display name {manualOverrides.displayName ? "(Manual override)" : ""}</span>
              <input onChange={(event) => updateManualDraft("displayName", event.target.value)} value={manualDrafts.displayName} />
            </label>
            <label className="freelancer-field">
              <span>WhatsApp number {manualOverrides.phoneNumber ? "(Manual override)" : ""}</span>
              <input onChange={(event) => updateManualDraft("phoneNumber", event.target.value)} value={manualDrafts.phoneNumber} />
            </label>
            <label className="freelancer-field">
              <span>Connection state</span>
              <select value={connection.status} onChange={(event) => updateField("status", event.target.value)}>
                <option>Not started</option>
                <option>Onboarding in progress</option>
                <option>Business submitted</option>
                <option>Number connected</option>
                <option>Ready for webhook</option>
              </select>
            </label>
            <label className="freelancer-field">
              <span>Public base URL</span>
              <input
                defaultValue={connection.publicBaseUrl}
                onBlur={(event) => updateField("publicBaseUrl", event.target.value)}
                placeholder="https://app.aicloser.in"
              />
            </label>
            <label className="freelancer-field">
              <span>Verify token</span>
              <input defaultValue={connection.verifyToken} onBlur={(event) => updateField("verifyToken", event.target.value)} placeholder="Paste the same token in Meta webhook settings" />
            </label>
            <label className="freelancer-field">
              <span>Graph API version</span>
              <input defaultValue={connection.graphApiVersion} onBlur={(event) => updateField("graphApiVersion", event.target.value)} placeholder="v23.0" />
            </label>
            <label className="freelancer-field">
              <span>Meta business ID {manualOverrides.businessId ? "(Manual override)" : ""}</span>
              <input onChange={(event) => updateManualDraft("businessId", event.target.value)} placeholder="Paste Meta business ID" value={manualDrafts.businessId} />
            </label>
            <label className="freelancer-field">
              <span>Business portfolio ID {manualOverrides.businessPortfolioId ? "(Manual override)" : ""}</span>
              <input
                onChange={(event) => updateManualDraft("businessPortfolioId", event.target.value)}
                placeholder="Paste Meta business portfolio ID"
                value={manualDrafts.businessPortfolioId}
              />
            </label>
            <label className="freelancer-field">
              <span>WhatsApp Business Account ID {manualOverrides.wabaId ? "(Manual override)" : ""}</span>
              <input onChange={(event) => updateManualDraft("wabaId", event.target.value)} placeholder="Paste WABA ID" value={manualDrafts.wabaId} />
            </label>
            <label className="freelancer-field">
              <span>Phone number ID {manualOverrides.phoneNumberId ? "(Manual override)" : ""}</span>
              <input onChange={(event) => updateManualDraft("phoneNumberId", event.target.value)} placeholder="Paste phone number ID" value={manualDrafts.phoneNumberId} />
            </label>
            <label className="freelancer-field">
              <span>System user ID {manualOverrides.systemUserId ? "(Manual override)" : ""}</span>
              <input onChange={(event) => updateManualDraft("systemUserId", event.target.value)} placeholder="Paste Meta system user ID" value={manualDrafts.systemUserId} />
            </label>
            <label className="freelancer-field">
              <span>Authorization code</span>
              <input
                defaultValue={connection.authorizationCode}
                onBlur={(event) => updateField("authorizationCode", event.target.value)}
                placeholder="Paste the Meta authorization code if it returns separately"
              />
            </label>
            <label className="freelancer-field freelancer-field-full">
              <span>Access token</span>
              <textarea
                defaultValue={connection.accessToken}
                onBlur={(event) => updateField("accessToken", event.target.value)}
                placeholder="Paste permanent access token for later Graph API and webhook work"
              />
            </label>
            <label className="freelancer-field">
              <span>WhatsApp payments</span>
              <select
                value={connection.paymentsEnabled ? "enabled" : "disabled"}
                onChange={(event) => {
                  persistConnection({ paymentsEnabled: event.target.value === "enabled" }).catch(() => undefined);
                }}
              >
                <option value="enabled">Enabled</option>
                <option value="disabled">Disabled</option>
              </select>
            </label>
            <label className="freelancer-field">
              <span>Payment gateway</span>
              <select value={connection.paymentsGateway ?? "payu"} onChange={(event) => updateField("paymentsGateway", event.target.value)}>
                <option value="payu">PayU</option>
                <option value="razorpay">Razorpay</option>
                <option value="zaakpay">Zaakpay</option>
              </select>
            </label>
            <label className="freelancer-field freelancer-field-full">
              <span>Payment configuration name</span>
              <input
                defaultValue={connection.paymentsConfigurationName}
                onBlur={(event) => updateField("paymentsConfigurationName", event.target.value)}
                placeholder="Meta payment configuration name"
              />
            </label>
            <label className="freelancer-field freelancer-field-full">
              <span>Payment template name</span>
              <input
                defaultValue={connection.paymentsTemplateName ?? "gigxomi_order_details"}
                onBlur={(event) => updateField("paymentsTemplateName", event.target.value)}
                placeholder="Order details template name"
              />
            </label>
            <label className="freelancer-field freelancer-field-full">
              <span>Subscription payment CTA template name</span>
              <input
                defaultValue={connection.subscriptionPaymentTemplateName ?? ""}
                onBlur={(event) => updateField("subscriptionPaymentTemplateName", event.target.value)}
                placeholder="Approved CTA template for payment link"
              />
            </label>
            <label className="freelancer-field">
              <span>Subscription payment template language</span>
              <input
                defaultValue={connection.subscriptionPaymentTemplateLanguage ?? "en_US"}
                onBlur={(event) => updateField("subscriptionPaymentTemplateLanguage", event.target.value)}
                placeholder="en_US"
              />
            </label>
            <label className="freelancer-field freelancer-field-full">
              <span>Renewal reminder CTA template name</span>
              <input
                defaultValue={connection.renewalReminderTemplateName ?? ""}
                onBlur={(event) => updateField("renewalReminderTemplateName", event.target.value)}
                placeholder="Approved CTA template for renewal reminders"
              />
            </label>
            <label className="freelancer-field">
              <span>Renewal reminder template language</span>
              <input
                defaultValue={connection.renewalReminderTemplateLanguage ?? "en_US"}
                onBlur={(event) => updateField("renewalReminderTemplateLanguage", event.target.value)}
                placeholder="en_US"
              />
            </label>
            <label className="freelancer-field freelancer-field-full">
              <span>OTP authentication template name</span>
              <input
                defaultValue={connection.otpTemplateName ?? ""}
                onBlur={(event) => updateField("otpTemplateName", event.target.value)}
                placeholder="Approved AUTHENTICATION template name"
              />
            </label>
            <label className="freelancer-field">
              <span>OTP template language</span>
              <input
                defaultValue={connection.otpTemplateLanguage ?? "en_US"}
                onBlur={(event) => updateField("otpTemplateLanguage", event.target.value)}
                placeholder="en_US"
              />
            </label>
            <p className="muted-copy freelancer-field freelancer-field-full">
              Use an approved Meta <strong>AUTHENTICATION</strong> template with a copy-code button so OTP arrives like the secure WhatsApp code card.
            </p>
            <p className="muted-copy freelancer-field freelancer-field-full">
              Use approved CTA templates with a URL button at index <strong>0</strong>. Gigxomi fills the payment page link dynamically so users can tap and pay from WhatsApp.
            </p>
            <label className="freelancer-field freelancer-field-full">
              <span>Launch note</span>
              <textarea defaultValue={connection.note} onBlur={(event) => updateField("note", event.target.value)} />
            </label>
          </div>
        </>
      ) : null}
      <div className="brief-grid three-up">
        <article className="brief-card">
          <span className="meta-pill">Callback URL</span>
          <strong>{webhookUrl}</strong>
          <p className="muted-copy">Set this as the Meta webhook callback URL for the live app.</p>
          <button className="secondary-button" onClick={() => handleCopyValue(webhookUrl, "Webhook URL")} type="button">
            <Copy size={14} strokeWidth={1.8} />
            Copy webhook URL
          </button>
        </article>
        <article className="brief-card">
          <span className="meta-pill">Verify token</span>
          <strong>{connection.verifyToken || "Not available"}</strong>
          <p className="muted-copy">Meta sends this back during webhook verification. It must match exactly.</p>
          <button className="secondary-button" onClick={() => handleCopyValue(connection.verifyToken, "Verify token")} type="button">
            <Copy size={14} strokeWidth={1.8} />
            Copy verify token
          </button>
        </article>
        <article className="brief-card">
          <span className="meta-pill">Webhook activity</span>
          <strong>Inbound: {formatEventTime(connection.lastInboundAt)}</strong>
          <p className="muted-copy">Outbound: {formatEventTime(connection.lastOutboundAt)}</p>
          <p className="muted-copy">Signup event: {connection.lastSignupEvent ? `${connection.lastSignupEvent} @ ${formatEventTime(connection.lastSignupEventAt)}` : "Not received yet"}</p>
          <p className="muted-copy">{connection.lastError?.trim() ? `Last error: ${connection.lastError}` : "No webhook/send errors recorded in this session."}</p>
        </article>
      </div>
      <div className="brief-grid three-up">
        <article className="brief-card">
          <span className="meta-pill">Meta App</span>
          <strong>{connection.metaAppId || "Not available"}</strong>
          <p className="muted-copy">Embedded signup app ID from the current onboarding link.</p>
          <button className="secondary-button" onClick={() => handleCopyValue(connection.metaAppId, "Meta app ID")} type="button">
            <Copy size={14} strokeWidth={1.8} />
            Copy app ID
          </button>
        </article>
        <article className="brief-card">
          <span className="meta-pill">Config</span>
          <strong>{connection.metaConfigId || "Not available"}</strong>
          <p className="muted-copy">Embedded signup configuration ID from the current onboarding link.</p>
          <button className="secondary-button" onClick={() => handleCopyValue(connection.metaConfigId, "Meta config ID")} type="button">
            <Copy size={14} strokeWidth={1.8} />
            Copy config ID
          </button>
        </article>
        <article className="brief-card">
          <span className="meta-pill">Embedded version</span>
          <strong>{connection.embeddedSignupVersion || "Not available"}</strong>
          <p className="muted-copy">Session info version: {connection.sessionInfoVersion || "Not available"}</p>
        </article>
      </div>
      {showAdvancedDebug ? <div className="brief-grid three-up">
        {[
          { label: "Business ID", value: connection.businessId },
          { label: "Portfolio ID", value: connection.businessPortfolioId },
          { label: "WABA ID", value: connection.wabaId },
          { label: "Phone Number ID", value: connection.phoneNumberId },
          { label: "System User ID", value: connection.systemUserId },
          { label: "Authorization Code", value: connection.authorizationCode },
          { label: "Access Token", value: connection.accessToken },
        ].map((item) => (
          <article className="brief-card" key={item.label}>
            <span className="meta-pill">{item.label}</span>
            <strong>{item.value ? (item.label === "Access Token" || item.label === "Authorization Code" ? `${item.value.slice(0, 18)}...` : item.value) : "Not captured yet"}</strong>
            <p className="muted-copy">
              {item.label === "Access Token"
                ? "Store the token here for later Graph API and webhook testing."
                : item.label === "Authorization Code"
                  ? "If Meta returns a code, store it here so you can exchange it for a fresh token later."
                  : `Captured from the Meta setup flow for ${item.label.toLowerCase()}.`}
            </p>
            <button className="secondary-button" onClick={() => handleCopyValue(item.value, item.label)} type="button">
              <Copy size={14} strokeWidth={1.8} />
              Copy {item.label}
            </button>
          </article>
        ))}
      </div> : null}
      <div className="stack-list">
        <div className="section-copy">
          <p className="section-label">Test send</p>
          <h3>Send a WhatsApp message from live setup</h3>
          <p className="muted-copy">This uses the stored access token and phone number ID. It is the fastest way to validate outbound Cloud API delivery before relying on the routed inbox UI.</p>
        </div>
        <div className="freelancer-form-grid">
          <label className="freelancer-field">
            <span>Recipient number</span>
            <input onChange={(event) => setTestRecipient(event.target.value)} placeholder="+91..." value={testRecipient} />
          </label>
          <label className="freelancer-field freelancer-field-full">
            <span>Message body</span>
            <textarea onChange={(event) => setTestMessage(event.target.value)} rows={3} value={testMessage} />
          </label>
        </div>
        <div className="freelancer-action-grid">
          <button className="freelancer-primary-button" onClick={handleSendTestMessage} type="button">
            Send test message
          </button>
          <button className="freelancer-secondary-button" onClick={() => setTestMessage("Hello from Gigxomi live webhook setup.")} type="button">
            Reset test message
          </button>
        </div>
      </div>
      {status ? <p className="helper-text">{status}</p> : null}
      <div className="freelancer-inline-list">
        {connection.launchChecklist.map((item) => (
          <div className="freelancer-inline-row" key={item}>
            <CheckCheck size={14} strokeWidth={1.8} />
            <span>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminYouTubeConnectionCard() {
  const [connection, setConnection] = useState<DummyYouTubeConnectionState | null>(null);
  const [uploads, setUploads] = useState<DummyYouTubeUploadRecord[]>([]);

  useEffect(() => {
    fetchYouTubeConnection()
      .then((payload) => {
        setConnection(payload.connection);
        setUploads(payload.uploads);
      })
      .catch(() => {
        setConnection(null);
        setUploads([]);
      });
  }, []);

  if (!connection) {
    return null;
  }

  return (
    <article className="brief-card">
      <span className="meta-pill">{connection.status}</span>
      <strong>YouTube Delivery Setup</strong>
      <p className="muted-copy">{connection.channelName || "No channel saved yet"}</p>
      <p className="muted-copy">
        Last upload: {formatEventTime(connection.lastUploadAt)} {connection.lastPlaylistName ? `- ${connection.lastPlaylistName}` : ""}
      </p>
      <p className="muted-copy">{uploads.length} routed uploads tracked in dummy mode.</p>
      <Link className="secondary-button" href="/admin/system-settings">
        Open agency settings
      </Link>
    </article>
  );
}

export function AdminYouTubeSetupPanel() {
  const [connection, setConnection] = useState<DummyYouTubeConnectionState | null>(null);
  const [uploads, setUploads] = useState<DummyYouTubeUploadRecord[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchYouTubeConnection()
      .then((payload) => {
        setConnection(payload.connection);
        setUploads(payload.uploads);
      })
      .catch(() => {
        setConnection(null);
        setUploads([]);
      });
  }, []);

  async function persistConnection(
    updates: Partial<
      Pick<
        DummyYouTubeConnectionState,
        | "status"
        | "channelName"
        | "channelId"
        | "channelHandle"
        | "defaultPrivacy"
        | "defaultPlaylistPrefix"
        | "clientId"
        | "clientSecret"
        | "refreshToken"
        | "accessToken"
        | "note"
        | "lastUploadAt"
        | "lastPlaylistName"
        | "lastError"
      >
    >,
    nextStatusMessage?: string,
  ) {
    setIsSaving(true);

    const response = await fetch("/api/admin/youtube", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: updates.status ?? connection?.status,
        channelName: updates.channelName ?? connection?.channelName,
        channelId: updates.channelId ?? connection?.channelId,
        channelHandle: updates.channelHandle ?? connection?.channelHandle,
        defaultPrivacy: updates.defaultPrivacy ?? connection?.defaultPrivacy,
        defaultPlaylistPrefix: updates.defaultPlaylistPrefix ?? connection?.defaultPlaylistPrefix,
        clientId: updates.clientId ?? connection?.clientId,
        clientSecret: updates.clientSecret ?? connection?.clientSecret,
        refreshToken: updates.refreshToken ?? connection?.refreshToken,
        accessToken: updates.accessToken ?? connection?.accessToken,
        note: updates.note ?? connection?.note,
        lastUploadAt: updates.lastUploadAt ?? connection?.lastUploadAt,
        lastPlaylistName: updates.lastPlaylistName ?? connection?.lastPlaylistName,
        lastError: updates.lastError ?? connection?.lastError,
      }),
    });

    const payload = await response.json();
    setConnection((payload.connection ?? null) as DummyYouTubeConnectionState | null);
    setUploads((payload.uploads ?? []) as DummyYouTubeUploadRecord[]);
    setStatus(nextStatusMessage ?? "YouTube delivery setup saved locally.");
    setIsSaving(false);
  }

  async function updateField(
    key:
      | "status"
      | "channelName"
      | "channelId"
      | "channelHandle"
      | "defaultPrivacy"
      | "defaultPlaylistPrefix"
      | "clientId"
      | "clientSecret"
      | "refreshToken"
      | "accessToken"
      | "note",
    value: string,
  ) {
    await persistConnection({ [key]: value } as Partial<DummyYouTubeConnectionState>);
  }

  if (!connection) {
    return null;
  }

  return (
    <div className="stack-list">
      <div className="brief-grid three-up">
        <article className="brief-card">
          <span className="meta-pill">{connection.status}</span>
          <strong>Channel mapping</strong>
          <p className="muted-copy">Use one agency delivery channel so managers and editors can push client-ready videos into a predictable place.</p>
        </article>
        <article className="brief-card">
          <span className="meta-pill">Privacy</span>
          <strong>{connection.defaultPrivacy}</strong>
          <p className="muted-copy">New routed uploads use this privacy setting until real YouTube OAuth upload is wired.</p>
        </article>
        <article className="brief-card">
          <span className="meta-pill">Client playlists</span>
          <strong>{connection.defaultPlaylistPrefix}</strong>
          <p className="muted-copy">Each chat upload creates or reuses a client playlist name like &quot;{connection.defaultPlaylistPrefix} - Client Name&quot;.</p>
        </article>
      </div>

      <div className="brief-grid three-up">
        {[
          { label: "Mark mapped", value: "Channel mapped" },
          { label: "Mark upload ready", value: "Upload ready" },
          { label: "Pause uploads", value: "Not connected" },
        ].map((item) => (
          <button
            className="brief-card"
            disabled={isSaving}
            key={item.value}
            onClick={() => persistConnection({ status: item.value as DummyYouTubeConnectionState["status"] }, `${item.label} saved.`)}
            type="button"
          >
            <span className="meta-pill">{item.value}</span>
            <strong>{item.label}</strong>
            <p className="muted-copy">This controls whether chat uploads are routed into client-specific YouTube playlists or stay queued in dummy mode.</p>
          </button>
        ))}
      </div>

      <div className="freelancer-form-grid">
        <label className="freelancer-field">
          <span>Channel name</span>
          <input defaultValue={connection.channelName} onBlur={(event) => updateField("channelName", event.target.value)} />
        </label>
        <label className="freelancer-field">
          <span>Channel ID</span>
          <input defaultValue={connection.channelId} onBlur={(event) => updateField("channelId", event.target.value)} placeholder="UC..." />
        </label>
        <label className="freelancer-field">
          <span>Channel handle</span>
          <input defaultValue={connection.channelHandle} onBlur={(event) => updateField("channelHandle", event.target.value)} placeholder="@agencychannel" />
        </label>
        <label className="freelancer-field">
          <span>Upload privacy</span>
          <select defaultValue={connection.defaultPrivacy} onChange={(event) => updateField("defaultPrivacy", event.target.value)}>
            <option value="private">private</option>
            <option value="unlisted">unlisted</option>
            <option value="public">public</option>
          </select>
        </label>
        <label className="freelancer-field">
          <span>Client playlist prefix</span>
          <input defaultValue={connection.defaultPlaylistPrefix} onBlur={(event) => updateField("defaultPlaylistPrefix", event.target.value)} />
        </label>
        <label className="freelancer-field">
          <span>Connection state</span>
          <select defaultValue={connection.status} onChange={(event) => updateField("status", event.target.value)}>
            <option>Not connected</option>
            <option>Channel mapped</option>
            <option>Upload ready</option>
          </select>
        </label>
        <label className="freelancer-field">
          <span>OAuth client ID</span>
          <input defaultValue={connection.clientId} onBlur={(event) => updateField("clientId", event.target.value)} placeholder="Google OAuth client ID" />
        </label>
        <label className="freelancer-field">
          <span>Client secret</span>
          <input defaultValue={connection.clientSecret} onBlur={(event) => updateField("clientSecret", event.target.value)} placeholder="Google OAuth client secret" />
        </label>
        <label className="freelancer-field">
          <span>Refresh token</span>
          <input defaultValue={connection.refreshToken} onBlur={(event) => updateField("refreshToken", event.target.value)} placeholder="YouTube refresh token" />
        </label>
        <label className="freelancer-field freelancer-field-full">
          <span>Access token</span>
          <textarea defaultValue={connection.accessToken} onBlur={(event) => updateField("accessToken", event.target.value)} placeholder="Optional local token for future real upload testing" />
        </label>
        <label className="freelancer-field freelancer-field-full">
          <span>Upload note</span>
          <textarea defaultValue={connection.note} onBlur={(event) => updateField("note", event.target.value)} />
        </label>
      </div>

      <div className="brief-grid three-up">
        <article className="brief-card">
          <span className="meta-pill">Last upload</span>
          <strong>{formatEventTime(connection.lastUploadAt)}</strong>
          <p className="muted-copy">{connection.lastPlaylistName ? `Latest playlist: ${connection.lastPlaylistName}` : "No client playlist has been created yet."}</p>
        </article>
        <article className="brief-card">
          <span className="meta-pill">Error state</span>
          <strong>{connection.lastError?.trim() ? "Needs attention" : "Clear"}</strong>
          <p className="muted-copy">{connection.lastError?.trim() || "No YouTube routing errors have been recorded in this session."}</p>
        </article>
        <article className="brief-card">
          <span className="meta-pill">Recent routed uploads</span>
          <strong>{uploads.length}</strong>
          <p className="muted-copy">Chat uploads will create client playlists automatically once the channel is marked upload ready.</p>
        </article>
      </div>

      {status ? <p className="helper-text">{status}</p> : null}

      <div className="freelancer-inline-list">
        {connection.uploadChecklist.map((item) => (
          <div className="freelancer-inline-row" key={item}>
            <CheckCheck size={14} strokeWidth={1.8} />
            <span>{item}</span>
          </div>
        ))}
      </div>

      <div className="board-list">
        {uploads.slice(0, 4).map((upload) => (
          <article className="lead-row" key={upload.id}>
            <div className="status-row">
              <span className="meta-pill">{upload.status}</span>
              <span className="meta-pill">{upload.privacy}</span>
            </div>
            <h3>{upload.title}</h3>
            <p>{upload.customerName}</p>
            <p>
              <strong>Playlist:</strong> {upload.playlistName}
            </p>
            <p>
              <strong>Uploaded by:</strong> {upload.uploadedByLabel}
            </p>
            {upload.shareUrl ? (
              <a className="secondary-button" href={upload.shareUrl} rel="noreferrer" target="_blank">
                Open recorded link
                <ExternalLink size={14} strokeWidth={1.8} />
              </a>
            ) : null}
          </article>
        ))}
        {!uploads.length ? <p className="muted-copy">No chat-driven YouTube uploads have been recorded yet.</p> : null}
      </div>
    </div>
  );
}
