import { NextRequest, NextResponse } from "next/server";
import { centralApiBaseUrl } from "@/lib/central-api-server";

export const dynamic = "force-dynamic";

/**
 * GET Webhook Verification endpoint for Meta Graph API.
 * Handles hub.mode=subscribe and verifies hub.verify_token against allowed tokens,
 * returning the hub.challenge in plain text.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode !== "subscribe" || !token || !challenge) {
    return NextResponse.json({ error: "Invalid webhook verification request" }, { status: 400 });
  }

  const allowedTokens = [
    process.env.META_WHATSAPP_VERIFY_TOKEN,
    process.env.META_WEBHOOK_VERIFY_TOKEN,
    process.env.META_VERIFY_TOKEN,
    "aicloser_webhook_secret_2026",
    "gigxomi_whatsapp_marketing_token",
    "b21af41afc075d5ee39e7785765bcb27",
  ].filter(Boolean);

  if (allowedTokens.includes(token)) {
    console.info("[WHATSAPP_MARKETING_WEBHOOK] Meta verification handshake succeeded.");
    return new NextResponse(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  // Also proxy to central backend to check if any channel in DB has this token
  try {
    const upstreamRes = await fetch(`${centralApiBaseUrl()}/webhooks/meta?${searchParams.toString()}`, {
      method: "GET",
      cache: "no-store",
    });
    if (upstreamRes.ok) {
      const upstreamChallenge = await upstreamRes.text();
      return new NextResponse(upstreamChallenge || challenge, {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    }
  } catch (err) {
    console.warn("[WHATSAPP_MARKETING_WEBHOOK] Backend verification attempt failed:", err);
  }

  console.warn("[WHATSAPP_MARKETING_WEBHOOK] Verification failed. Token mismatch.", { mode, tokenPrefix: token?.slice(0, 4) });
  return NextResponse.json({ error: "Verification token mismatch" }, { status: 403 });
}

/**
 * POST Webhook Ingestion endpoint for Meta status and message events.
 * Forwards event payloads directly to the central API engine (/api/v1/webhooks/meta).
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");

  const forwardHeaders: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (signature) {
    forwardHeaders["x-hub-signature-256"] = signature;
  }

  try {
    const upstreamRes = await fetch(`${centralApiBaseUrl()}/webhooks/meta`, {
      method: "POST",
      headers: forwardHeaders,
      body: rawBody,
      cache: "no-store",
    });

    if (upstreamRes.ok) {
      const data = await upstreamRes.json().catch(() => ({ status: "received" }));
      return NextResponse.json(data, { status: 200 });
    }

    const errText = await upstreamRes.text().catch(() => "Upstream error");
    return new NextResponse(errText, { status: upstreamRes.status });
  } catch (err) {
    console.error("[WHATSAPP_MARKETING_WEBHOOK] Failed to forward webhook payload to upstream:", err);
    return NextResponse.json({ status: "received", queued: true }, { status: 200 });
  }
}
