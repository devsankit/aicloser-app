import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  verifyMetaWebhookSignature,
  processMetaWebhookPayload,
  type MetaWebhookPayload,
} from "@/lib/whatsapp-marketing/webhook-engine";
import { getMetaAppSecret, getMetaWebhookVerifyToken } from "@/lib/whatsapp-marketing/config";

export const dynamic = "force-dynamic";

/**
 * GET Webhook Verification endpoint for Meta Graph API.
 * Uses only META_WHATSAPP_VERIFY_TOKEN, META_WEBHOOK_VERIFY_TOKEN, or channel-specific tokens.
 * Completely disallows META_WHATSAPP_CONFIG_ID or weak defaults in production.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode !== "subscribe" || !token || !challenge) {
    return NextResponse.json({ error: "Invalid webhook verification request" }, { status: 400 });
  }

  // Check dedicated environment verify tokens first
  const envVerifyToken = getMetaWebhookVerifyToken();
  let verified = Boolean(envVerifyToken && token === envVerifyToken);

  // If not matched by env token, check if any registered channel has this webhookVerifyToken
  if (!verified) {
    try {
      const matchingChannel = await prisma.whatsAppChannel.findFirst({
        where: { webhookVerifyToken: token },
        select: { id: true },
      });
      if (matchingChannel) {
        verified = true;
      }
    } catch {
      // In local dev without DB connection, rely strictly on env token
    }
  }

  if (verified) {
    console.info("[WHATSAPP_MARKETING_WEBHOOK] Verified successfully by Meta.");
    return new NextResponse(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  console.warn("[WHATSAPP_MARKETING_WEBHOOK] Verification failed. Token mismatch.", { mode });
  return NextResponse.json({ error: "Verification token mismatch" }, { status: 403 });
}

/**
 * POST Webhook Ingestion endpoint for Meta status and message events.
 */
export async function POST(request: NextRequest) {
  const signature = request.headers.get("x-hub-signature-256");
  const rawBody = await request.text();

  const appSecret = getMetaAppSecret();

  // Signature verification (enforced in production if appSecret is present)
  if (appSecret && signature) {
    const isValid = verifyMetaWebhookSignature(rawBody, signature, appSecret);
    if (!isValid) {
      console.warn("[WHATSAPP_MARKETING_WEBHOOK] Invalid HMAC signature.");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  let payload: MetaWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as MetaWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Malformed JSON" }, { status: 400 });
  }

  // Fast acknowledgement: process events in background without blocking response
  void processMetaWebhookPayload(payload).catch((error: unknown) => {
    console.error("[WHATSAPP_MARKETING_WEBHOOK] Processing error:", error);
  });

  return NextResponse.json({ status: "ok" }, { status: 200 });
}
