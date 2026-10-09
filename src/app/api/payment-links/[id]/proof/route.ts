import { NextResponse } from "next/server";

import { requireSessionRole } from "@/lib/api/require-session-role";
import { attachUpiPaymentProof, readUpiProof, tenantForSession } from "@/lib/upi-payment-collection";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authorization = await requireSessionRole(["ADMIN", "SALES_AGENT"]);
  if (!authorization.ok) return authorization.response;
  try {
    const { id } = await params;
    const proof = await readUpiProof(id, tenantForSession(authorization.session), authorization.session.role, authorization.session.userId);
    if (!proof) return new NextResponse("Proof not found.", { status: 404 });
    return new NextResponse(proof.bytes as BodyInit, { headers: { "Content-Type": proof.mimeType, "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow, noarchive" } });
  } catch {
    return new NextResponse("Proof unavailable.", { status: 404 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authorization = await requireSessionRole(["ADMIN", "SALES_AGENT"]);
  if (!authorization.ok) return authorization.response;
  try {
    const { id } = await params;
    const form = await request.formData();
    const proof = form.get("proof");
    if (!(proof instanceof File)) return NextResponse.json({ ok: false, error: "Please choose a payment screenshot." }, { status: 400 });
    const paymentLink = await attachUpiPaymentProof({ id, tenantId: tenantForSession(authorization.session), actorUserId: authorization.session.userId, actorRole: authorization.session.role, proof });
    return NextResponse.json({ ok: true, paymentLink });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Could not attach payment proof." }, { status: 400 });
  }
}
