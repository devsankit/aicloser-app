import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { acquireAppClientSession } from "@/lib/auth/client-sessions";
import {
  GOOGLE_ONBOARDING_COOKIE,
  readGoogleOnboardingCookie,
} from "@/lib/auth/google-oauth";
import { applySessionCookie } from "@/lib/auth/session";
import { provisionSaaSCloserWorkspace } from "@/lib/gigxomi/sales-store";

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  const requestCookies = await cookies();
  const claims = readGoogleOnboardingCookie(requestCookies.get(GOOGLE_ONBOARDING_COOKIE)?.value);
  if (!claims) return NextResponse.json({ ok: false, error: "GoogleOnboardingExpired", message: "Google signup expired. Start again from Continue with Google." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ ok: false, error: "InvalidSignupDetails", message: "Send valid workspace details." }, { status: 400 });

  const companyName = readString(body.companyName);
  const displayName = readString(body.displayName) || claims.displayName;
  const phone = readString(body.phone);
  if (!companyName || !displayName || !phone) {
    return NextResponse.json({ ok: false, error: "MissingSignupDetails", message: "Workspace name, full name, and phone are required." }, { status: 400 });
  }

  const result = await provisionSaaSCloserWorkspace({
    companyName,
    displayName,
    email: claims.email,
    phone,
    password: randomBytes(32).toString("base64url"),
    googleIdentity: {
      googleSubject: claims.googleSubject,
      email: claims.email,
      displayName,
      avatarUrl: claims.avatarUrl,
    },
  });
  if (!result.ok) return NextResponse.json({ ok: false, error: "GoogleSignupFailed", message: result.error }, { status: 400 });

  const installationId = randomBytes(16).toString("hex");
  const clientSession = await acquireAppClientSession({
    userId: result.user.id,
    tenantId: result.user.tenantId,
    channel: "DESKTOP",
    installationId,
    deviceName: "Desktop Web",
    platform: "WEB",
    replaceExisting: true,
  });
  const response = NextResponse.json({ ok: true, redirectTo: claims.redirectTo || "/admin/chat" });
  await applySessionCookie(response, {
    userId: result.user.id,
    role: result.user.role,
    assignedRole: result.user.assignedRole,
    tenantId: result.user.tenantId,
    displayName: result.user.displayName,
    email: result.user.email,
    phone: result.user.phone,
    packageId: result.user.packageId,
    packageName: result.user.packageName,
    packageAudience: result.user.packageAudience,
    packageStatus: result.user.packageStatus,
    packageExpiresAt: result.user.packageExpiresAt,
    workspaceMode: result.user.workspaceMode,
    sessionId: clientSession.session.sessionId,
    licensedSession: true,
  });
  response.cookies.set(GOOGLE_ONBOARDING_COOKIE, "", { path: "/", maxAge: 0 });
  response.cookies.set("gx_client_installation", installationId, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}
