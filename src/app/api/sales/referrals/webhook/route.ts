import { NextResponse } from "next/server";

import { requireSessionRole } from "@/lib/api/require-session-role";
import {
  dispatchReferralWebhookTest,
  getReferralWebhookConfig,
  saveReferralWebhookConfig,
  type ReferralWebhookEvent,
} from "@/lib/gigxomi/referral-webhook-store";

export async function GET() {
  const authorization = await requireSessionRole(["SUPER_ADMIN", "ADMIN", "SALES_AGENT"]);
  if (!authorization.ok) return authorization.response;

  const config = await getReferralWebhookConfig();
  return NextResponse.json({
    ok: true,
    config,
    inboundEndpoint: "/api/sales/referrals/webhook/inbound",
  });
}

export async function POST(request: Request) {
  const authorization = await requireSessionRole(["SUPER_ADMIN", "ADMIN", "SALES_AGENT"]);
  if (!authorization.ok) return authorization.response;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
  }

  if (body.action === "test") {
    const agentCode = String(body.agentCode ?? "closer").trim() || "closer";
    const result = await dispatchReferralWebhookTest(agentCode);
    return NextResponse.json({
      ok: result.ok,
      message: result.statusText,
      config: result.config,
    });
  }

  const events = Array.isArray(body.events)
    ? (body.events.map((e) => String(e)) as ReferralWebhookEvent[])
    : undefined;

  const config = await saveReferralWebhookConfig({
    pluginEnabled: typeof body.pluginEnabled === "boolean" ? body.pluginEnabled : undefined,
    webhookEnabled: typeof body.webhookEnabled === "boolean" ? body.webhookEnabled : undefined,
    webhookUrl: typeof body.webhookUrl === "string" ? body.webhookUrl : undefined,
    webhookSecret: typeof body.webhookSecret === "string" ? body.webhookSecret : undefined,
    events,
  });

  return NextResponse.json({
    ok: true,
    message: "Referral plugin & webhook configuration saved.",
    config,
  });
}
