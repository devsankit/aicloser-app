import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const route = fs.readFileSync(new URL("../src/app/api/conversations/[id]/registration-status/route.ts", import.meta.url), "utf8");
const normalizer = fs.readFileSync(new URL("../src/lib/gigxomi/registration-status.ts", import.meta.url), "utf8");
const chat = fs.readFileSync(new URL("../src/components/chat/chat-workspace.tsx", import.meta.url), "utf8");

test("registration status is self-contained and queries local database directly without external API calls", () => {
  assert.doesNotMatch(route, /fetch\(target/);
  assert.doesNotMatch(route, /https:\/\/app\.gigxomi\.com/);
  assert.match(route, /prisma\.appAuthUser\.findFirst/);
  assert.match(route, /normalizeRegistrationStatus\(payload, phone\)/);
});

test("registration normalization separates billing, validity, channel, and phone-match states", () => {
  assert.match(normalizer, /BillingState = "PAID" \| "TRIAL" \| "TRIAL_EXPIRED" \| "FREE" \| "PAYMENT_PENDING" \| "UNKNOWN"/);
  assert.match(normalizer, /planExpiresAt/);
  assert.match(normalizer, /planDaysRemaining/);
  assert.match(normalizer, /whatsappMatch/);
  assert.match(normalizer, /paymentTransactions/);
  assert.match(normalizer, /amount > 0/);
  assert.match(normalizer, /normalizePhoneForMatch/);
});

test("chat shows app, audience, billing, channel, validity, and WhatsApp matching states", () => {
  assert.match(chat, /Freelancer Registration/i);
  assert.match(chat, /Billing/);
  assert.match(chat, /Valid until/);
  assert.match(chat, /WhatsApp number/);
  assert.match(chat, /Agency WhatsApp:/);
  assert.match(chat, /Instagram/);
});
