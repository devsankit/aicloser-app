import { NextResponse } from "next/server";
import { createSessionToken } from "@/lib/auth-token";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  let parsedState: { redirectTo?: string; origin?: string; codeVerifier?: string } = {};
  try {
    if (stateParam) {
      parsedState = JSON.parse(Buffer.from(stateParam, "base64url").toString("utf8"));
    }
  } catch {}

  const origin = parsedState.origin || url.origin;
  const destination = parsedState.redirectTo || "/dashboard";

  if (error || !code) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error || "GoogleLoginCancelled")}`);
  }

  const clientId = process.env.GOOGLE_LOGIN_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || "";
  const clientSecret = process.env.GOOGLE_LOGIN_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || "";
  const isLocal = origin.includes("localhost") || origin.includes("127.0.0.1");
  const redirectUri = isLocal
    ? `${origin}/api/auth/google/callback`
    : (process.env.GOOGLE_LOGIN_REDIRECT_URI || `${origin}/api/auth/google/callback`);

  try {
    // 1. Exchange authorization code with Google for tokens
    const tokenRequestBody: Record<string, string> = {
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    };
    if (parsedState.codeVerifier) {
      tokenRequestBody.code_verifier = parsedState.codeVerifier;
    }

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(tokenRequestBody),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.id_token) {
      throw new Error(tokenData.error_description || tokenData.error || "Token exchange failed with Google");
    }

    // 2. Decode ID token to obtain verified Google profile
    const [, payloadPart] = tokenData.id_token.split(".");
    const googleUser = JSON.parse(Buffer.from(payloadPart, "base64url").toString("utf8"));
    const email = googleUser.email || "";
    const displayName = googleUser.name || email.split("@")[0] || "Google User";

    // 3. Obtain session token from Central API or mint a signed session token
    let sessionToken = "";
    const centralApiUrl = process.env.AICLOSER_API_URL || "https://api.aicloser.in/api/v1";

    try {
      const loginRes = await fetch(`${centralApiUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: email,
          password: "",
          googleIdToken: tokenData.id_token,
          forceReplace: true,
          clientType: "DESKTOP",
        }),
      });
      const loginJson = await loginRes.json().catch(() => ({}));
      if (loginJson.data?.token) {
        sessionToken = loginJson.data.token;
      }
    } catch {
      // Fallback to minted session
    }

    if (!sessionToken) {
      sessionToken = await createSessionToken({
        userId: `google-${googleUser.sub}`,
        email,
        displayName,
        role: "ADMIN",
        tenantId: "tenant-the-storage-test-1d01dda2",
      });
    }

    // 4. Set authentication cookies and redirect to local destination
    const targetUrl = new URL(destination.startsWith("/") ? destination : `/${destination}`, origin);
    // Include token in query parameter so client-side store can pick it up immediately
    targetUrl.searchParams.set("auth_token", sessionToken);

    const response = NextResponse.redirect(targetUrl.toString());
    response.cookies.set("aicloser_token", sessionToken, {
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
      sameSite: "lax",
    });
    return response;
  } catch (err: any) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(err.message || "GoogleLoginFailed")}`);
  }
}
