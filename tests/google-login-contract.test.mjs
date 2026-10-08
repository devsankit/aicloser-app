import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const oauth = fs.readFileSync(new URL("../src/lib/auth/google-oauth.ts", import.meta.url), "utf8");
const start = fs.readFileSync(new URL("../src/app/api/auth/google/start/route.ts", import.meta.url), "utf8");
const callback = fs.readFileSync(new URL("../src/app/api/auth/google/callback/route.ts", import.meta.url), "utf8");
const onboarding = fs.readFileSync(new URL("../src/app/api/sales/auth/google/signup/route.ts", import.meta.url), "utf8");
const login = fs.readFileSync(new URL("../src/components/sales/sales-auth.tsx", import.meta.url), "utf8");
const schema = fs.readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8");

test("Google login uses a dedicated OAuth client and PKCE state", () => {
  assert.match(oauth, /GOOGLE_LOGIN_CLIENT_ID/);
  assert.match(oauth, /GOOGLE_LOGIN_CLIENT_SECRET/);
  assert.match(oauth, /code_challenge_method.*S256/);
  assert.match(oauth, /createHmac\("sha256"/);
  assert.match(start, /httpOnly: true/);
  assert.match(start, /sameSite: "lax"/);
});

test("Google callback validates the signed state and verified ID token", () => {
  assert.match(callback, /readGoogleOAuthState/);
  assert.match(callback, /verifyGoogleIdToken/);
  assert.match(callback, /GoogleEmailAlreadyRegistered/);
  assert.doesNotMatch(callback, /console\.log\([^)]*access_token/);
});

test("first Google login collects workspace details and creates a server-linked identity", () => {
  assert.match(schema, /model AppGoogleIdentity/);
  assert.match(schema, /googleSubject\s+String\s+@unique/);
  assert.match(onboarding, /readGoogleOnboardingCookie/);
  assert.match(onboarding, /provisionSaaSCloserWorkspace/);
  assert.match(onboarding, /googleIdentity:/);
  assert.match(login, /Continue with Google/);
});

test("Google login does not reuse the Sheets OAuth environment variables", () => {
  assert.match(oauth, /GOOGLE_LOGIN_REDIRECT_URI/);
  assert.doesNotMatch(oauth, /GOOGLE_OAUTH_REDIRECT_URI/);
});
