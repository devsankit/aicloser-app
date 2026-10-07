import { NextResponse } from "next/server";

import { clearImpersonationCookies } from "@/lib/auth/impersonation";
import { getPublicRequestUrl } from "@/lib/auth/request-url";
import { clearSessionCookie } from "@/lib/auth/session";

function createLogoutResponse(request: Request) {
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
