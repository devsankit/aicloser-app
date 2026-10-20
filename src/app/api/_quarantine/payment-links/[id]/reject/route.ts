import { NextResponse } from "next/server";

import { requireSessionRole } from "@/lib/api/require-session-role";
import { rejectUpiPaymentLink, tenantForSession } from "@/lib/upi-payment-collection";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authorization = await requireSessionRole(["ADMIN"]);
  if (!authorization.ok) return authorization.response;
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    return NextResponse.json({
      ok: true,
      paymentLink: await rejectUpiPaymentLink({
        id,
        tenantId: tenantForSession(authorization.session),
        actorUserId: authorization.session.userId,
        actorRole: authorization.session.role,
        reason: body.reason,
      }),
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Could not reject payment." }, { status: 400 });
  }
}
