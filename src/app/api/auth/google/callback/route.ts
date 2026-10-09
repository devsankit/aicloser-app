import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { acquireAppClientSession } from "@/lib/auth/client-sessions";
import { findUserByIdentifier } from "@/lib/auth/store";
import {
  GOOGLE_ONBOARDING_COOKIE,
  GOOGLE_STATE_COOKIE,
  buildGoogleAuthorizationUrl,
  createGoogleOnboardingCookie,
  getGoogleLoginConfig,
  getSafeGoogleRedirect,
  readGoogleOAuthState,
  verifyGoogleIdToken,
} from "@/lib/auth/google-oauth";
import { applySessionCookie, getDashboardPathForIdentity, getSafeRedirectPath } from "@/lib/auth/session";
import { getSalesAgentAccess } from "@/lib/gigxomi/sales-store";
import { getPublicRequestUrl } from "@/lib/auth/request-url";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function loginRedirect(request: Request, error: string, redirectTo?: string) {
  const url = getPublicRequestUrl(request, "/login");
  url.searchParams.set("error", error);
  if (redirectTo) url.searchParams.set("redirectTo", getSafeGoogleRedirect(redirectTo));
  return NextResponse.redirect(url);
}

function clearStateCookie(response: NextResponse) {
  response.cookies.set(GOOGLE_STATE_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}

async function exchangeCode(input: { code: string; verifier: string; clientId: string; clientSecret: string; redirectUri: string }) {
  const body = new URLSearchParams({
    code: input.code,
    client_id: input.clientId,
    client_secret: input.clientSecret,
    redirect_uri: input.redirectUri,
    grant_type: "authorization_code",
    code_verifier: input.verifier,
  });
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body,
  });
  if (!response.ok) throw new Error("Google token exchange failed.");
  return (await response.json()) as { id_token?: string };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requestCookies = await cookies();
  const savedState = readGoogleOAuthState(requestCookies.get(GOOGLE_STATE_COOKIE)?.value, url.searchParams.get("state"));
  const publicOrigin = getPublicRequestUrl(request, "/").origin;
  const config = getGoogleLoginConfig(publicOrigin);
  if (!savedState) return clearStateCookie(loginRedirect(request, "GoogleLoginStateInvalid"));
  if (!config.configured) return clearStateCookie(loginRedirect(request, "GoogleLoginNotConfigured", savedState.redirectTo));
  if (url.searchParams.get("error")) return clearStateCookie(loginRedirect(request, "GoogleLoginCancelled", savedState.redirectTo));

  const code = url.searchParams.get("code");
  if (!code) return clearStateCookie(loginRedirect(request, "GoogleAuthorizationCodeMissing", savedState.redirectTo));

  try {
    const tokenResponse = await exchangeCode({
      code,
      verifier: savedState.codeVerifier,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      redirectUri: config.redirectUri,
    });
    if (!tokenResponse.id_token) throw new Error("Google did not return an identity token.");
    const identity = await verifyGoogleIdToken(tokenResponse.id_token, config.clientId);
    const existingIdentity = await prisma.appGoogleIdentity.findUnique({ where: { googleSubject: identity.sub }, include: { user: true } });

    if (!existingIdentity) {
      const existingEmailUser = await findUserByIdentifier(identity.email);
      if (existingEmailUser) {
        return clearStateCookie(loginRedirect(request, "GoogleEmailAlreadyRegistered", savedState.redirectTo));
      }

      const response = clearStateCookie(NextResponse.redirect(getPublicRequestUrl(request, "/signup?google=onboarding")));
      response.cookies.set(
        GOOGLE_ONBOARDING_COOKIE,
        createGoogleOnboardingCookie({
          googleSubject: identity.sub,
          email: identity.email,
          displayName: identity.name,
          avatarUrl: identity.picture,
          redirectTo: savedState.redirectTo,
        }),
        {
          path: "/",
          httpOnly: true,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
          maxAge: 10 * 60,
        },
      );
      return response;
    }

    const user = existingIdentity.user;
    const salesAccess = ["ADMIN", "MANAGER", "SALES_AGENT"].includes(user.role)
      ? await getSalesAgentAccess(user.id)
      : null;
    const workspaceRole = String(salesAccess?.agent?.permissions?.workspaceRole ?? "").toUpperCase();
    const effectiveRole = ["ADMIN", "MANAGER", "SALES_AGENT"].includes(workspaceRole) ? workspaceRole : user.role;
    const effectiveAssignedRole = ["ADMIN", "MANAGER", "SALES_AGENT"].includes(workspaceRole) ? workspaceRole : user.assignedRole;
    const installationId = randomBytes(16).toString("hex");
    const clientSession = await acquireAppClientSession({
      userId: user.id,
      tenantId: user.tenantId,
      channel: "DESKTOP",
      installationId,
      deviceName: "Desktop Web",
      platform: "WEB",
      replaceExisting: true,
    });
    await prisma.appAuthUser.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    const destination = getSafeRedirectPath(savedState.redirectTo, effectiveRole as Parameters<typeof getSafeRedirectPath>[1]);
    const response = clearStateCookie(NextResponse.redirect(getPublicRequestUrl(request, destination || getDashboardPathForIdentity({ role: effectiveRole as Parameters<typeof getDashboardPathForIdentity>[0]["role"], packageAudience: user.packageAudience, workspaceMode: user.workspaceMode }))));
    await applySessionCookie(response, {
      userId: user.id,
      role: effectiveRole as Parameters<typeof applySessionCookie>[1]["role"],
      assignedRole: effectiveAssignedRole as Parameters<typeof applySessionCookie>[1]["assignedRole"],
      tenantId: user.tenantId,
      displayName: user.displayName,
      email: user.email,
      phone: user.phone ?? "",
      packageId: user.packageId,
      packageName: user.packageName,
      packageAudience: user.packageAudience,
      packageStatus: user.packageStatus,
      packageExpiresAt: user.packageExpiresAt?.toISOString() ?? null,
      workspaceMode: user.workspaceMode,
      sessionId: clientSession.session.sessionId,
      licensedSession: true,
    });
    response.cookies.set("gx_client_installation", installationId, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365,
    });
    return response;
  } catch (error) {
    console.error("Google login callback failed", error instanceof Error ? error.message : "unknown error");
    return clearStateCookie(loginRedirect(request, "GoogleLoginFailed", savedState.redirectTo));
  }
}
