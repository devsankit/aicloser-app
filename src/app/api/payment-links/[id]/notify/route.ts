import { NextResponse } from "next/server";

import { requireSessionRole } from "@/lib/api/require-session-role";
import { resendUpiPaymentApprovalWebhook, tenantForSession } from "@/lib/upi-payment-collection";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const authorization = await requireSessionRole(["ADMIN"]);
  if (!authorization.ok) return authorization.response;
  try {
    const { id } = await context.params;
    const tenantId = tenantForSession(authorization.session);
    const result = await resendUpiPaymentApprovalWebhook({ id, tenantId, actorUserId: authorization.session.userId });
    return NextResponse.json({ ok: true, delivery: result });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Could not send order confirmation." }, { status: 400 });
  }
}
