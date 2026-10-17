import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { createPublicRedirect, sanitizePublicAuthError } from "@/lib/auth/public-redirect";
import { shouldUseSecureCookies } from "@/lib/auth/cookie-security";
import { applySessionCookie, getSafeRedirectPath, getSafeSalesRedirectPath } from "@/lib/auth/session";
import { SUPER_ADMIN_HOME_ROUTE, SUPER_ADMIN_LOGIN_ROUTE } from "@/lib/auth/super-admin-config";

type LoginScope = "public" | "sales" | "manager" | "super-admin";
type ClientType = "DESKTOP" | "MOBILE";

type BackendLoginUser = {
  userId: string;
  displayName: string;
  email?: string | null;
  phone?: string | null;
  role: "SUPER_ADMIN" | "ADMIN" | "MANAGER" | "SALES_AGENT";
  tenantId: string | null;
  sessionId: string;
  clientType: ClientType;
};

type BackendLoginResponse = {
  success?: boolean;
  data?: { token?: string; user?: BackendLoginUser; resumed?: boolean };
  error?: string | null;
  message?: string;
};

function getApiBaseUrl() {
  return (
    process.env.AICLOSER_API_URL?.trim() ||
    process.env.NEXT_PUBLIC_AICLOSER_API_URL?.trim() ||
    "https://api.aicloser.in/api/v1"
  ).replace(/\/$/, "");
}

function getLoginScope(value: string): LoginScope {
  return value === "super-admin" || value === "manager" || value === "sales" ? value : "public";
}

function getLoginPath(scope: LoginScope) {
  if (scope === "super-admin") return SUPER_ADMIN_LOGIN_ROUTE;
  if (scope === "manager") return "/manager-login";
  return "/login";
}

function getBackendError(payload: BackendLoginResponse, fallback: string) {
  return payload.message?.trim() || payload.error?.trim() || fallback;
}

function isRoleAllowed(scope: LoginScope, role: BackendLoginUser["role"]) {
  if (scope === "super-admin") return role === "SUPER_ADMIN";
  if (scope === "manager") return role === "MANAGER";
  if (scope === "sales") return role === "SALES_AGENT" || role === "MANAGER" || role === "ADMIN";
  return true;
}

export async function POST(request: Request) {
  let loginPath = "/login";
  let wantsJson = false;

  try {
    const contentType = request.headers.get("content-type") || "";
    wantsJson = contentType.includes("application/json");
    const input: Record<string, unknown> = wantsJson
      ? ((await request.json().catch(() => ({}))) as Record<string, unknown>)
      : Object.fromEntries((await request.formData()).entries());

    const identifier = String(input.identifier ?? "").trim();
    const password = String(input.password ?? "").trim();
    const redirectTo = String(input.redirectTo ?? "").trim();
    const scope = getLoginScope(String(input.loginScope ?? "").trim());
    const clientType: ClientType = String(input.clientType ?? "").trim().toUpperCase() === "MOBILE" ? "MOBILE" : "DESKTOP";
    const forceReplace = String(input.forceReplace ?? "").trim() === "1";
    const requestCookies = await cookies();
    const installationId =
      String(input.installationId ?? "").trim() ||
      request.headers.get("x-installation-id")?.trim() ||
      requestCookies.get("gx_client_installation")?.value?.trim() ||
      `web-${crypto.randomUUID()}`;

    loginPath = getLoginPath(scope);

    if (!identifier || !password) {
      const error = "Enter your email/phone and password.";
      return wantsJson
        ? NextResponse.json({ ok: false, error: "MissingCredentials", message: error }, { status: 400 })
        : createPublicRedirect(loginPath, { error });
    }

    const response = await fetch(`${getApiBaseUrl()}/auth/login`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "x-installation-id": installationId,
      },
      body: JSON.stringify({
        identifier,
        password,
        clientType,
        installationId,
        replaceExisting: forceReplace,
        deviceName: clientType === "DESKTOP" ? "Desktop Web" : "Mobile App",
        platform: clientType === "DESKTOP" ? "WEB" : "ANDROID",
      }),
      cache: "no-store",
    });
    const payload = (await response.json().catch(() => ({}))) as BackendLoginResponse;
    const user = payload.data?.user;
    const token = payload.data?.token;

    if (!response.ok || payload.success === false || !user || !token) {
      const error = getBackendError(
        payload,
        response.status === 401 ? "Invalid email/phone or password." : "We could not sign you in right now. Please try again in a moment.",
      );
      const details = { error: payload.error || "LoginFailed", message: error, identifier, clientType, redirectTo };
      return wantsJson
        ? NextResponse.json({ ok: false, ...details }, { status: response.status || 502 })
        : createPublicRedirect(loginPath, details);
    }

    if (!isRoleAllowed(scope, user.role)) {
      const error = scope === "super-admin"
        ? "Only the authorized super-admin account can sign in here."
        : scope === "manager"
          ? "Only manager accounts can sign in from the manager login page."
          : "Only approved sales accounts can sign in here.";
      return wantsJson
        ? NextResponse.json({ ok: false, error: "RoleNotAllowed", message: error }, { status: 403 })
        : createPublicRedirect(loginPath, { error });
    }

    const effectiveRole = user.role;
    const destination = scope === "super-admin"
      ? (redirectTo ? getSafeRedirectPath(redirectTo, user.role) : SUPER_ADMIN_HOME_ROUTE)
      : scope === "sales"
        ? getSafeSalesRedirectPath(redirectTo, effectiveRole)
        : redirectTo
          ? getSafeRedirectPath(redirectTo, user.role)
          : "/";

    const nextResponse = wantsJson
      ? NextResponse.json({ ok: true, token, user, resumed: payload.data?.resumed, redirectTo: destination })
      : createPublicRedirect(destination);

    // The API owns authentication. This signed cookie only lets the existing
    // Next.js page guards recognize the API-authenticated user during migration.
    await applySessionCookie(nextResponse, {
      userId: user.userId,
      role: user.role,
      assignedRole: user.role,
      tenantId: user.tenantId,
      displayName: user.displayName,
      email: user.email ?? null,
      phone: user.phone ?? null,
      packageId: null,
      packageName: null,
      packageAudience: null,
      packageStatus: null,
      packageExpiresAt: null,
      workspaceMode: null,
      sessionId: user.sessionId,
      licensedSession: false,
    });
    nextResponse.cookies.set("gx_client_installation", installationId, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: shouldUseSecureCookies(),
      maxAge: 60 * 60 * 24 * 365,
    });
    nextResponse.cookies.set("aicloser_token", token, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: shouldUseSecureCookies(),
      maxAge: 60 * 60 * 24 * 30,
    });

    return nextResponse;
  } catch (error) {
    console.error("New API password login failed", error);
    const message = sanitizePublicAuthError(error, "We could not sign you in right now. Please try again in a moment.");
    return wantsJson
      ? NextResponse.json({ ok: false, error: "LoginFailed", message }, { status: 502 })
      : createPublicRedirect(loginPath, { error: message });
  }
}
