import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import { touchAppClientSession } from "@/lib/auth/client-sessions";

export async function POST() {
  const session = await getSessionContext();
  if (!session.userId || !session.sessionId) {
    return NextResponse.json({ ok: false, error: "Unauthorized", message: "A licensed session is required" }, { status: 401 });
  }
  const touched = await touchAppClientSession(session.sessionId);
  if (!touched) {
    return NextResponse.json({ ok: false, error: "SessionRevoked", message: "This client session is no longer active" }, { status: 401 });
  }
  return NextResponse.json({ ok: true, lastActiveAt: touched.lastActiveAt });
}
