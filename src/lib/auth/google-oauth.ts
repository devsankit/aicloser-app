import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const GOOGLE_STATE_COOKIE = "gx_google_oauth_state";
export const GOOGLE_ONBOARDING_COOKIE = "gx_google_onboarding";
export const GOOGLE_OAUTH_COOKIE_MAX_AGE = 10 * 60;

type SignedPayload = {
  createdAt: number;
  [key: string]: unknown;
};

export type GoogleOAuthState = {
  state: string;
  codeVerifier: string;
  redirectTo: string;
};

export type GoogleOnboardingClaims = {
  googleSubject: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  redirectTo: string;
};

export type VerifiedGoogleIdentity = {
  sub: string;
  email: string;
  name: string;
  picture: string | null;
};

function getStateSecret() {
  return (
    process.env.GOOGLE_LOGIN_STATE_SECRET?.trim() ||
    process.env.SESSION_SECRET?.trim() ||
    process.env.GIGXOMI_SESSION_SECRET?.trim() ||
    "aicloser-google-login-state-secret"
  );
}

function encode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(value: string) {
  return createHmac("sha256", getStateSecret()).update(value).digest("base64url");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function pack(payload: SignedPayload) {
  const encoded = encode(JSON.stringify(payload));
  return `${encoded}.${sign(encoded)}`;
}

function unpack<T extends SignedPayload>(value: string | null | undefined): T | null {
  if (!value) return null;
  const [encoded, signature] = value.split(".");
  if (!encoded || !signature || !safeEqual(signature, sign(encoded))) return null;
  try {
    const payload = JSON.parse(decode(encoded)) as T;
    if (!payload.createdAt || Date.now() - payload.createdAt > GOOGLE_OAUTH_COOKIE_MAX_AGE * 1000) return null;
    return payload;
  } catch {
    return null;
  }
}

export function getGoogleLoginConfig(requestUrl?: string) {
  const clientId = process.env.GOOGLE_LOGIN_CLIENT_ID?.trim() || "";
  const clientSecret = process.env.GOOGLE_LOGIN_CLIENT_SECRET?.trim() || "";
  const configuredRedirect = process.env.GOOGLE_LOGIN_REDIRECT_URI?.trim() || "";
  const fallbackBase = process.env.NEXT_PUBLIC_APP_URL?.trim() || requestUrl || "http://localhost:3012";
  const redirectUri = configuredRedirect || new URL("/api/auth/google/callback", fallbackBase).toString();
  return {
    clientId,
    clientSecret,
    redirectUri,
    configured: Boolean(clientId && clientSecret),
  };
}

export function getSafeGoogleRedirect(value: string | null | undefined) {
  const candidate = value?.trim() || "/";
  if (!candidate.startsWith("/") || candidate.startsWith("//") || candidate.startsWith("/api/auth/google")) return "/";
  return candidate;
}

export function createGoogleOAuthState(redirectTo: string): GoogleOAuthState & { cookieValue: string; codeChallenge: string } {
  const state = randomBytes(24).toString("base64url");
  const codeVerifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
  const cookieValue = pack({ createdAt: Date.now(), state, codeVerifier, redirectTo: getSafeGoogleRedirect(redirectTo) });
  return { state, codeVerifier, codeChallenge, redirectTo: getSafeGoogleRedirect(redirectTo), cookieValue };
}

export function readGoogleOAuthState(cookieValue: string | null | undefined, state: string | null | undefined) {
  const payload = unpack<{ createdAt: number; state?: string; codeVerifier?: string; redirectTo?: string }>(cookieValue);
  if (!payload || !state || payload.state !== state || !payload.codeVerifier) return null;
  return {
    codeVerifier: payload.codeVerifier,
    redirectTo: getSafeGoogleRedirect(payload.redirectTo),
  };
}

export function createGoogleOnboardingCookie(claims: GoogleOnboardingClaims) {
  return pack({ createdAt: Date.now(), ...claims, redirectTo: getSafeGoogleRedirect(claims.redirectTo) });
}

export function readGoogleOnboardingCookie(cookieValue: string | null | undefined): GoogleOnboardingClaims | null {
  const payload = unpack<GoogleOnboardingClaims & { createdAt: number }>(cookieValue);
  if (!payload || !payload.googleSubject || !payload.email) return null;
  return {
    googleSubject: payload.googleSubject,
    email: payload.email,
    displayName: payload.displayName || "",
    avatarUrl: payload.avatarUrl || null,
    redirectTo: getSafeGoogleRedirect(payload.redirectTo),
  };
}

export function buildGoogleAuthorizationUrl(input: { clientId: string; redirectUri: string; state: string; codeChallenge: string; mode: "login" | "signup" }) {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", input.state);
  url.searchParams.set("code_challenge", input.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("prompt", "select_account");
  url.searchParams.set("access_type", "online");
  // Keep signup and login on the same consent surface. The signed state carries the mode.
  return url;
}

function decodeJwtPart(value: string) {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Record<string, unknown>;
}

function base64UrlBytes(value: string) {
  return Uint8Array.from(Buffer.from(value, "base64url"));
}

let googleKeysCache: { expiresAt: number; keys: Array<Record<string, unknown>> } | null = null;

export async function verifyGoogleIdToken(idToken: string, expectedAudience: string, fetcher: typeof fetch = fetch): Promise<VerifiedGoogleIdentity> {
  const [encodedHeader, encodedPayload, encodedSignature] = idToken.split(".");
  if (!encodedHeader || !encodedPayload || !encodedSignature) throw new Error("Google returned an invalid identity token.");
  const header = decodeJwtPart(encodedHeader);
  const payload = decodeJwtPart(encodedPayload);
  if (header.alg !== "RS256" || typeof header.kid !== "string") throw new Error("Google identity token uses an unsupported signature.");
  const issuer = payload.iss;
  const audience = payload.aud;
  const expiresAt = Number(payload.exp ?? 0);
  const issuedAt = Number(payload.iat ?? 0);
  const audienceMatches = Array.isArray(audience) ? audience.includes(expectedAudience) : audience === expectedAudience;
  if ((issuer !== "https://accounts.google.com" && issuer !== "accounts.google.com") || !audienceMatches || expiresAt <= Math.floor(Date.now() / 1000) || issuedAt > Math.floor(Date.now() / 1000) + 300) {
    throw new Error("Google identity token validation failed.");
  }
  if (typeof payload.sub !== "string" || typeof payload.email !== "string" || payload.email_verified !== true) {
    throw new Error("Google account email is not verified.");
  }

  if (!googleKeysCache || googleKeysCache.expiresAt <= Date.now()) {
    const response = await fetcher("https://www.googleapis.com/oauth2/v3/certs", { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("Google signing keys are unavailable.");
    const body = (await response.json()) as { keys?: Array<Record<string, unknown>> };
    googleKeysCache = { keys: body.keys ?? [], expiresAt: Date.now() + 60 * 60 * 1000 };
  }
  const jwk = googleKeysCache.keys.find((key) => key.kid === header.kid);
  if (!jwk) throw new Error("Google identity token signing key was not found.");
  const publicKey = await crypto.subtle.importKey("jwk", jwk as JsonWebKey, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const verified = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", publicKey, base64UrlBytes(encodedSignature), new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`));
  if (!verified) throw new Error("Google identity token signature is invalid.");

  return {
    sub: payload.sub,
    email: payload.email.toLowerCase(),
    name: typeof payload.name === "string" ? payload.name : "",
    picture: typeof payload.picture === "string" ? payload.picture : null,
  };
}
