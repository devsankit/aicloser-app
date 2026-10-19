import { NextResponse } from "next/server";
import { createHash, randomBytes } from "node:crypto";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin; // e.g. "http://localhost:3050"
  const clientId = process.env.GOOGLE_LOGIN_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || "";

  if (!clientId) {
    return NextResponse.redirect(new URL("/login?error=GoogleLoginNotConfigured", origin));
  }

  // Dynamic redirectUri matching the local port or configured URI
  const isLocal = origin.includes("localhost") || origin.includes("127.0.0.1");
  const redirectUri = isLocal
    ? `${origin}/api/auth/google/callback`
    : (process.env.GOOGLE_LOGIN_REDIRECT_URI || `${origin}/api/auth/google/callback`);

  const redirectTo = url.searchParams.get("redirectTo") || "/dashboard";
  const codeVerifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
  const state = Buffer.from(JSON.stringify({ redirectTo, origin, codeVerifier, time: Date.now() })).toString("base64url");

  const googleAuthUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  googleAuthUrl.searchParams.set("client_id", clientId);
  googleAuthUrl.searchParams.set("redirect_uri", redirectUri);
  googleAuthUrl.searchParams.set("response_type", "code");
  googleAuthUrl.searchParams.set("scope", "openid email profile");
  googleAuthUrl.searchParams.set("state", state);
  googleAuthUrl.searchParams.set("code_challenge", codeChallenge);
  googleAuthUrl.searchParams.set("code_challenge_method", "S256");
  googleAuthUrl.searchParams.set("access_type", "online");
  googleAuthUrl.searchParams.set("prompt", "select_account");

  return NextResponse.redirect(googleAuthUrl.toString());
}
