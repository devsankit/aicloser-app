import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { clearImpersonationCookies, SUPER_ADMIN_RETURN_COOKIE_NAME } from "@/lib/auth/impersonation";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { verifySessionToken } from "@/lib/auth/token";

function redirectPath(path: string) {
  return new NextResponse(null, { status: 303, headers: { Location: path } });
}

async function handleReturn(request: Request) {
  const cookieStore = await cookies();
  const superAdminToken =
    cookieStore.get(SUPER_ADMIN_RETURN_COOKIE_NAME)?.value ||
    cookieStore.get(SESSION_COOKIE_NAME)?.value;

  const acceptsJson = request.headers.get("accept")?.includes("application/json");

  if (!superAdminToken) {
    if (acceptsJson) {
      return NextResponse.json({ ok: false, redirectUrl: "/super-admin/login" }, { status: 401 });
    }
    return redirectPath("/super-admin/login");
  }

  const verified = await verifySessionToken(superAdminToken);
  if (!verified || verified.role !== "SUPER_ADMIN") {
    const errorResponse = acceptsJson
      ? NextResponse.json({ ok: false, redirectUrl: "/super-admin/login?error=Invalid+session" }, { status: 401 })
      : redirectPath("/super-admin/login?error=Invalid+session");
    clearImpersonationCookies(errorResponse);
    return errorResponse;
  }

  const response = acceptsJson
    ? NextResponse.json({ ok: true, redirectUrl: "/super-admin", token: superAdminToken })
    : redirectPath("/super-admin");

  const expires = new Date(verified.expiresAt);
  const maxAge = Math.max(0, Math.ceil((verified.expiresAt - Date.now()) / 1000));
  const isProd = process.env.NODE_ENV === "production";

  // Restore Super Admin session cookies
  response.cookies.set(SESSION_COOKIE_NAME, superAdminToken, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    expires,
    maxAge,
  });
  response.cookies.set("aicloser_token", superAdminToken, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    expires,
    maxAge,
  });
  response.cookies.set("gx_role", "SUPER_ADMIN", {
    path: "/",
    sameSite: "lax",
    secure: isProd,
    expires,
    maxAge,
  });
  response.cookies.set("gx_tenant", verified.tenantId || "", {
    path: "/",
    sameSite: "lax",
    secure: isProd,
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
