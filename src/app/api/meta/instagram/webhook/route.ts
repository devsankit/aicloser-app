import { NextResponse } from "next/server";
import { verifyMetaWebhookSignature } from "@/lib/whatsapp-marketing/webhook-engine";
import { findInstagramConnectionStateByVerifyTokenFromFile, ingestInstagramWebhookPayloadFromFile, listInstagramConnectionStatesFromFile } from "@/lib/gigxomi/dummy-platform-file-store";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");
  if (params.get("hub.mode") !== "subscribe" || !token || !challenge) return NextResponse.json({ error: "Invalid verification request." }, { status: 400 });
  const configured = process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN?.trim();
  const matched = configured ? token === configured : Boolean(await findInstagramConnectionStateByVerifyTokenFromFile(token));
  return matched ? new NextResponse(challenge, { headers: { "Content-Type": "text/plain" } }) : NextResponse.json({ error: "Verification token mismatch." }, { status: 403 });
}

export async function POST(request: Request) {
  const secret = process.env.INSTAGRAM_OAUTH_CLIENT_SECRET?.trim();
  if (!secret) return NextResponse.json({ error: "Instagram webhook is not configured." }, { status: 503 });
  const raw = await request.text();
  const signature = request.headers.get("x-hub-signature-256");
  if (!signature || !verifyMetaWebhookSignature(raw, signature, secret)) return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  let payload;
  try { payload = JSON.parse(raw); } catch { return NextResponse.json({ error: "Malformed JSON." }, { status: 400 }); }
  if (payload?.object !== "instagram" || !Array.isArray(payload.entry)) return NextResponse.json({ error: "Unsupported Instagram event." }, { status: 400 });
  try {
    const connections = await listInstagramConnectionStatesFromFile();
    const knownAccounts = new Set(connections.filter((connection) => connection.pluginEnabled).map((connection) => connection.instagramBusinessAccountId).filter(Boolean));
    await ingestInstagramWebhookPayloadFromFile({ ...payload, entry: payload.entry.filter((entry: { id?: string }) => knownAccounts.has(String(entry.id || ""))) });
    return NextResponse.json({ status: "ok" });
  } catch {
    return NextResponse.json({ error: "Unable to persist Instagram event. Retry delivery." }, { status: 503 });
  }
}
