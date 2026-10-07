import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

export function verifyGigxomiJourneySignature(input: { body: string; signature: string | null; timestamp: string | null }) {
  const secret = process.env.GXCLOSERS_JOURNEY_SIGNING_SECRET?.trim();
  if (!secret || !input.signature || !input.timestamp) return false;
  const timestampNumber = Number(input.timestamp);
  if (!Number.isFinite(timestampNumber) || Math.abs(Date.now() - timestampNumber) > MAX_CLOCK_SKEW_MS) return false;
  const provided = input.signature.replace(/^sha256=/i, "").trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(provided)) return false;
  const expected = createHmac("sha256", secret).update(`${input.timestamp}.${input.body}`).digest("hex");
  return timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
}
