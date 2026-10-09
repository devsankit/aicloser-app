import { NextResponse } from "next/server";

import { requireSessionRole } from "@/lib/api/require-session-role";
import { approveUpiPaymentLink, tenantForSession } from "@/lib/upi-payment-collection";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authorization = await requireSessionRole(["ADMIN", "SALES_AGENT"]);
  if (!authorization.ok) return authorization.response;
  try {
    const { id } = await params;
    return NextResponse.json({
      ok: true,
      paymentLink: await approveUpiPaymentLink({
        id,
        tenantId: tenantForSession(authorization.session),
        actorUserId: authorization.session.userId,
        actorRole: authorization.session.role,
      }),
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Could not approve payment." }, { status: 400 });
  }
}
