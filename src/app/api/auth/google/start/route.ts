import { NextResponse } from "next/server";

import {
  GOOGLE_OAUTH_COOKIE_MAX_AGE,
  GOOGLE_STATE_COOKIE,
  buildGoogleAuthorizationUrl,
  createGoogleOAuthState,
  getGoogleLoginConfig,
  getSafeGoogleRedirect,
} from "@/lib/auth/google-oauth";
import { getPublicRequestUrl } from "@/lib/auth/request-url";

export const runtime = "nodejs";

function notConfigured(request: Request) {
  const acceptsHtml = request.headers.get("accept")?.includes("text/html");
  if (acceptsHtml) {
    return NextResponse.redirect(getPublicRequestUrl(request, "/login?error=GoogleLoginNotConfigured"));
  }
  return NextResponse.json(
    { ok: false, error: "GoogleLoginNotConfigured", message: "Google Sign-In is not configured for this environment." },
    { status: 503 },
  );
}

export async function GET(request: Request) {
  const publicOrigin = getPublicRequestUrl(request, "/").origin;
  const config = getGoogleLoginConfig(publicOrigin);
  if (!config.configured) return notConfigured(request);

  const url = new URL(request.url);
  const mode = url.searchParams.get("mode") === "signup" ? "signup" : "login";
  const state = createGoogleOAuthState(getSafeGoogleRedirect(url.searchParams.get("redirectTo")));
  const authorizationUrl = buildGoogleAuthorizationUrl({
    clientId: config.clientId,
    redirectUri: config.redirectUri,
    state: state.state,
    codeChallenge: state.codeChallenge,
    mode,
  });
  const response = NextResponse.redirect(authorizationUrl);
  response.cookies.set(GOOGLE_STATE_COOKIE, state.cookieValue, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: GOOGLE_OAUTH_COOKIE_MAX_AGE,
  });
  return response;
}
