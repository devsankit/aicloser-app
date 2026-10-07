import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { clearImpersonationCookies, SUPER_ADMIN_RETURN_COOKIE_NAME } from "@/lib/auth/impersonation";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { verifySessionToken } from "@/lib/auth/token";

async function handleReturn(request: Request) {
  const cookieStore = await cookies();
  const superAdminToken = cookieStore.get(SUPER_ADMIN_RETURN_COOKIE_NAME)?.value;

  const url = new URL(request.url);
  const targetDestination = new URL("/super-admin", url.origin);

  if (!superAdminToken) {
    return NextResponse.redirect(new URL("/super-admin/login", url.origin), 303);
  }

  const verified = await verifySessionToken(superAdminToken);
  if (!verified || verified.role !== "SUPER_ADMIN") {
    const errorResponse = NextResponse.redirect(new URL("/super-admin/login?error=Invalid+session", url.origin), 303);
    clearImpersonationCookies(errorResponse);
    return errorResponse;
  }

  const response = NextResponse.redirect(targetDestination, 303);

  // Restore Super Admin session cookie
  const expires = new Date(verified.expiresAt);
  const maxAge = Math.max(0, Math.ceil((verified.expiresAt - Date.now()) / 1000));
  response.cookies.set(SESSION_COOKIE_NAME, superAdminToken, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires,
    maxAge,
  });
  response.cookies.set("gx_role", "SUPER_ADMIN", {
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires,
    maxAge,
  });

  // Clear impersonation markers
  clearImpersonationCookies(response);
  response.cookies.set("gx_impersonating_name", "", { path: "/", maxAge: 0 });

  return response;
}

export async function GET(request: Request) {
  return handleReturn(request);
}

export async function POST(request: Request) {
  return handleReturn(request);
}
