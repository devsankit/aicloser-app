import { NextResponse } from "next/server";

import { clearImpersonationCookies } from "@/lib/auth/impersonation";
import { getPublicRequestUrl } from "@/lib/auth/request-url";
import { clearSessionCookie } from "@/lib/auth/session";
import { getSessionContext } from "@/lib/auth/session";
import { closeAppClientSession } from "@/lib/auth/client-sessions";

async function createLogoutResponse(request: Request) {
  const session = await getSessionContext();
  if (session.sessionId) await closeAppClientSession(session.sessionId, "LOGGED_OUT").catch(() => undefined);
  const acceptHeader = request.headers.get("accept") || "";
  const authHeader = request.headers.get("authorization") || "";
  if (acceptHeader.includes("application/json") || authHeader.startsWith("Bearer ")) {
    const jsonResponse = NextResponse.json({ ok: true });
    clearSessionCookie(jsonResponse);
    clearImpersonationCookies(jsonResponse);
    return jsonResponse;
  }
  const url = new URL(request.url);
  const redirectTo = url.searchParams.get("redirectTo")?.trim() || "/";
  const safeTarget = redirectTo.startsWith("/") && !redirectTo.startsWith("//") ? redirectTo : "/";
  const response = NextResponse.redirect(getPublicRequestUrl(request, safeTarget), 303);
  clearSessionCookie(response);
  clearImpersonationCookies(response);
  response.cookies.set("gx_impersonating_name", "", { path: "/", maxAge: 0 });
  return response;
}

export async function GET(request: Request) {
  return createLogoutResponse(request);
}

export async function POST(request: Request) {
  return createLogoutResponse(request);
}
