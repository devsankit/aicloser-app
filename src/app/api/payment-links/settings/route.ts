import { NextResponse } from "next/server";

import { requireSessionRole } from "@/lib/api/require-session-role";
import { getUpiSettings, saveUpiSettings, tenantForSession } from "@/lib/upi-payment-collection";

export async function GET(request: Request) {
  const authorization = await requireSessionRole(["ADMIN"]);
  if (!authorization.ok) return authorization.response;
  const tenantId = tenantForSession(authorization.session, new URL(request.url).searchParams.get("tenantId"));
  const result = await getUpiSettings(tenantId);
  const settings = { ...result.settings, confirmationWebhookSecret: "", confirmationWebhookSecretConfigured: Boolean(result.settings.confirmationWebhookSecret) };
  return NextResponse.json({ ok: true, tenantId, settings, policies: result.policies });
}

export async function PUT(request: Request) {
  const authorization = await requireSessionRole(["ADMIN"]);
  if (!authorization.ok) return authorization.response;
  try {
    const body = await request.json();
    const tenantId = tenantForSession(authorization.session, body.tenantId);
    const settings = await saveUpiSettings({ tenantId, userId: authorization.session.userId, ...body });
    return NextResponse.json({ ok: true, settings });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Could not save payment settings." }, { status: 400 });
  }
}
