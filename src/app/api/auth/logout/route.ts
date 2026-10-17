import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { clearImpersonationCookies } from "@/lib/auth/impersonation";
import { getPublicRequestUrl } from "@/lib/auth/request-url";
import { clearSessionCookie } from "@/lib/auth/session";
import { getSessionContext } from "@/lib/auth/session";
import { closeAppClientSession } from "@/lib/auth/client-sessions";

function getApiBaseUrl() {
  return (
    process.env.AICLOSER_API_URL?.trim() ||
    process.env.NEXT_PUBLIC_AICLOSER_API_URL?.trim() ||
    "https://api.aicloser.in/api/v1"
  ).replace(/\/$/, "");
}

async function createLogoutResponse(request: Request) {
  const requestCookies = await cookies();
  const apiToken = requestCookies.get("aicloser_token")?.value?.trim();
  if (apiToken) {
    await fetch(`${getApiBaseUrl()}/auth/logout`, {
      method: "POST",
      headers: { Accept: "application/json", Authorization: `Bearer ${apiToken}` },
      cache: "no-store",
    }).catch(() => undefined);
  }

  const session = await getSessionContext();
  if (session.sessionId) await closeAppClientSession(session.sessionId, "LOGGED_OUT").catch(() => undefined);
  const acceptHeader = request.headers.get("accept") || "";
  const authHeader = request.headers.get("authorization") || "";
  if (acceptHeader.includes("application/json") || authHeader.startsWith("Bearer ")) {
    const jsonResponse = NextResponse.json({ ok: true });
    clearSessionCookie(jsonResponse);
    clearImpersonationCookies(jsonResponse);
    jsonResponse.cookies.set("aicloser_token", "", { path: "/", maxAge: 0 });
    return jsonResponse;
  }
  const url = new URL(request.url);
  const redirectTo = url.searchParams.get("redirectTo")?.trim() || "/";
  const safeTarget = redirectTo.startsWith("/") && !redirectTo.startsWith("//") ? redirectTo : "/";
  const response = NextResponse.redirect(getPublicRequestUrl(request, safeTarget), 303);
  clearSessionCookie(response);
  clearImpersonationCookies(response);
  response.cookies.set("gx_impersonating_name", "", { path: "/", maxAge: 0 });
  response.cookies.set("aicloser_token", "", { path: "/", maxAge: 0 });
  return response;
}

export async function GET(request: Request) {
  return createLogoutResponse(request);
}

export async function POST(request: Request) {
  return createLogoutResponse(request);
}
