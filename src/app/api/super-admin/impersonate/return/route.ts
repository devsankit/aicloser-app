import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { clearImpersonationCookies, SUPER_ADMIN_RETURN_COOKIE_NAME } from "@/lib/auth/impersonation";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { verifySessionToken } from "@/lib/auth/token";

function redirectPath(path: string) {
  // Keep the Location header relative. Behind the production proxy,
  // request.url can expose the internal localhost:3050 origin; an absolute
  // redirect would leak that internal host and strand the restored session.
  return new NextResponse(null, { status: 303, headers: { Location: path } });
}

async function handleReturn(request: Request) {
  const cookieStore = await cookies();
  const superAdminToken = cookieStore.get(SUPER_ADMIN_RETURN_COOKIE_NAME)?.value;

  if (!superAdminToken) {
    return redirectPath("/super-admin/login");
  }

  const verified = await verifySessionToken(superAdminToken);
  if (!verified || verified.role !== "SUPER_ADMIN") {
    const errorResponse = redirectPath("/super-admin/login?error=Invalid+session");
    clearImpersonationCookies(errorResponse);
    return errorResponse;
  }

  const response = redirectPath("/super-admin");

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
