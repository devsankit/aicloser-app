import { NextResponse } from "next/server";

import { getSessionContext } from "@/lib/auth/session";
import { confirmPublicUpiPayment } from "@/lib/upi-payment-collection";

const attempts = new Map<string, { count: number; windowStartedAt: number }>();

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const clientKey = `${request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"}:${token}`;
    const now = Date.now();
    const previous = attempts.get(clientKey);
    const current = !previous || now - previous.windowStartedAt > 10 * 60 * 1000 ? { count: 0, windowStartedAt: now } : previous;
    current.count += 1;
    attempts.set(clientKey, current);
    if (current.count > 5) return NextResponse.json({ ok: false, error: "Too many confirmation attempts. Please try again later." }, { status: 429, headers: { "Retry-After": "600", "X-Robots-Tag": "noindex, nofollow, noarchive" } });
    const form = await request.formData();
    const session = await getSessionContext();
    const result = await confirmPublicUpiPayment({
      token, sessionUserId: session.role === "GUEST" ? null : session.userId,
      customerName: form.get("customerName"), customerPhone: form.get("customerPhone"), customerEmail: form.get("customerEmail"),
      utrReference: form.get("utrReference"), confirmationNote: form.get("confirmationNote"),
      proof: form.get("proof") instanceof File ? form.get("proof") as File : null,
    });
    return NextResponse.json({ ok: true, paymentLink: result }, { headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow, noarchive" } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Could not submit payment confirmation." }, { status: 400, headers: { "X-Robots-Tag": "noindex, nofollow, noarchive" } });
  }
}
