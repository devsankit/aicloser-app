import "server-only";

import type { NextResponse } from "next/server";

export const SUPER_ADMIN_RETURN_COOKIE_NAME = "gx_super_admin_return";
export const IMPERSONATION_MARKER_COOKIE_NAME = "gx_impersonating_agency";
export const IMPERSONATION_TTL_MS = 60 * 60 * 1000;

export function applyImpersonationCookies(
  response: NextResponse,
  input: { superAdminSessionToken: string; agencyUserId: string; expiresAt: number },
) {
  const expires = new Date(input.expiresAt);
  const maxAge = Math.max(0, Math.ceil((input.expiresAt - Date.now()) / 1000));
  const sharedOptions = {
    path: "/",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    expires,
    maxAge,
  };

  response.cookies.set(SUPER_ADMIN_RETURN_COOKIE_NAME, input.superAdminSessionToken, sharedOptions);
  response.cookies.set(IMPERSONATION_MARKER_COOKIE_NAME, input.agencyUserId, sharedOptions);
}

export function clearImpersonationCookies(response: NextResponse) {
  response.cookies.set(SUPER_ADMIN_RETURN_COOKIE_NAME, "", { path: "/", maxAge: 0 });
  response.cookies.set(IMPERSONATION_MARKER_COOKIE_NAME, "", { path: "/", maxAge: 0 });
}
