import { NextResponse } from "next/server";

import { getPublicUpiPaymentLink } from "@/lib/upi-payment-collection";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const paymentLink = await getPublicUpiPaymentLink(token);
  if (!paymentLink) return NextResponse.json({ ok: false, error: "Payment link not found or expired." }, { status: 404, headers: { "X-Robots-Tag": "noindex, nofollow, noarchive" } });
  return NextResponse.json({ ok: true, paymentLink }, { headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow, noarchive" } });
}
