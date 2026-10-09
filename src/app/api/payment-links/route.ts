import { NextResponse } from "next/server";

import { requireSessionRole } from "@/lib/api/require-session-role";
import { createUpiPaymentLink, listUpiPaymentLinks, tenantForSession } from "@/lib/upi-payment-collection";

export async function GET(request: Request) {
  const authorization = await requireSessionRole(["ADMIN", "MANAGER", "SALES_AGENT"]);
  if (!authorization.ok) return authorization.response;
  const url = new URL(request.url);
  const tenantId = tenantForSession(authorization.session, url.searchParams.get("tenantId"));
  const result = await listUpiPaymentLinks({ tenantId, userId: authorization.session.userId, role: authorization.session.role, limit: Number(url.searchParams.get("limit") || 100) });
  return NextResponse.json({ ok: true, ...result });
}

export async function POST(request: Request) {
  const authorization = await requireSessionRole(["ADMIN", "MANAGER", "SALES_AGENT"]);
  if (!authorization.ok) return authorization.response;
  try {
    const body = await request.json();
    const result = await createUpiPaymentLink({
      tenantId: tenantForSession(authorization.session, body.tenantId), createdByUserId: authorization.session.userId,
      baseAmount: body.baseAmount, quantity: body.quantity, duration: body.duration, durationUnit: body.durationUnit,
      customerUserId: body.customerUserId, customerName: body.customerName, customerPhone: body.customerPhone,
      customerEmail: body.customerEmail, productName: body.productName, packageId: body.packageId,
      customerNote: body.customerNote, customFields: body.customFields, validityValue: body.validityValue, validityUnit: body.validityUnit,
    });
    return NextResponse.json({ ok: true, paymentLink: result }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Could not create payment link." }, { status: 400 });
  }
}
