import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { verifySessionToken } from "@/lib/auth/token";

export async function proxy(request: NextRequest) {
  const session = await verifySessionToken(request.cookies.get("gx_session")?.value ?? null);
  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectTo", "/");
    return NextResponse.redirect(loginUrl);
  }
  if (session.role !== "SALES_AGENT") {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", "GXclosers is available only to approved sales accounts.");
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/"] };
