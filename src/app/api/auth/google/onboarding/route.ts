import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { GOOGLE_ONBOARDING_COOKIE, readGoogleOnboardingCookie } from "@/lib/auth/google-oauth";

export async function GET() {
  const requestCookies = await cookies();
  const claims = readGoogleOnboardingCookie(requestCookies.get(GOOGLE_ONBOARDING_COOKIE)?.value);
  if (!claims) return NextResponse.json({ ok: false, error: "GoogleOnboardingExpired" }, { status: 401 });
  return NextResponse.json({ ok: true, email: claims.email, displayName: claims.displayName });
}
