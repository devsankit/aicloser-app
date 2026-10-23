import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { verifySessionToken } from "@/lib/auth/token";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Static assets, Next internals, icons, and media files
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/assets") ||
    pathname === "/favicon.ico" ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".jpg") ||
    pathname.endsWith(".jpeg") ||
    pathname.endsWith(".svg") ||
    pathname.endsWith(".webp") ||
    pathname.endsWith(".css") ||
    pathname.endsWith(".js") ||
    pathname.endsWith(".apk")
  ) {
    return NextResponse.next();
  }

  // 2. Publicly accessible routes (Checkout, Inbound Forms, Auth flow, APK downloads)
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/super-admin/login") ||
    pathname.startsWith("/pay") ||
    pathname.startsWith("/payment-links") ||
    pathname.startsWith("/forms") ||
    pathname.startsWith("/go") ||
    pathname.startsWith("/latestapk") ||
    pathname.startsWith("/downloads") ||
    pathname.startsWith("/activate-plan") ||
    pathname.startsWith("/unauthorized")
  ) {
    return NextResponse.next();
  }

  // 3. API routes manage their own authentication middleware
  if (pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  // 4. Verify session token for protected CRM routes (check aicloser_token, gx_session, and Bearer header)
  const token =
    request.cookies.get("aicloser_token")?.value ??
    request.cookies.get("gx_session")?.value ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    null;

  const session = await verifySessionToken(token);

  if (!session) {
    if (pathname.startsWith("/super-admin")) {
      const returnToken = request.cookies.get("gx_super_admin_return")?.value;
      if (returnToken) {
        const returnSession = await verifySessionToken(returnToken);
        if (returnSession && returnSession.role === "SUPER_ADMIN") {
          return NextResponse.redirect(new URL("/api/super-admin/impersonate/return", request.url));
        }
      }
      const saLoginUrl = new URL("/super-admin/login", request.url);
      saLoginUrl.searchParams.set("redirectTo", pathname);
      return NextResponse.redirect(saLoginUrl);
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 5. Super Admin routes strict role check
  if (pathname.startsWith("/super-admin") && session.role !== "SUPER_ADMIN") {
    // If the user was impersonating and has a Super Admin return cookie, auto-return smoothly!
    const returnToken = request.cookies.get("gx_super_admin_return")?.value;
    if (returnToken) {
      const returnSession = await verifySessionToken(returnToken);
      if (returnSession && returnSession.role === "SUPER_ADMIN") {
        return NextResponse.redirect(new URL("/api/super-admin/impersonate/return", request.url));
      }
    }

    const saLoginUrl = new URL("/super-admin/login", request.url);
    saLoginUrl.searchParams.set("error", "Unauthorized: Super Admin credentials required");
    return NextResponse.redirect(saLoginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
