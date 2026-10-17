import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionContext } from "@/lib/auth/session";
import { touchAppClientSession } from "@/lib/auth/client-sessions";

function getApiBaseUrl() {
  return (
    process.env.AICLOSER_API_URL?.trim() ||
    process.env.NEXT_PUBLIC_AICLOSER_API_URL?.trim() ||
    "https://api.aicloser.in/api/v1"
  ).replace(/\/$/, "");
}

export async function POST() {
  const apiToken = (await cookies()).get("aicloser_token")?.value?.trim();
  if (apiToken) {
    const response = await fetch(`${getApiBaseUrl()}/auth/heartbeat`, {
      method: "POST",
      headers: { Accept: "application/json", Authorization: `Bearer ${apiToken}` },
      cache: "no-store",
    }).catch(() => null);
    if (response?.ok) {
      const payload = await response.json().catch(() => ({}));
      return NextResponse.json({ ok: true, lastActiveAt: payload.data?.lastActiveAt ?? null });
    }
    if (response?.status === 401) {
      return NextResponse.json({ ok: false, error: "SessionRevoked", message: "This client session is no longer active" }, { status: 401 });
    }
  }

  // During the API-only refactor there may be no direct frontend database
  // connection. Do not let the legacy heartbeat path turn a guest check into
  // a server error.
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json({ ok: false, error: "Unauthorized", message: "A central API session is required" }, { status: 401 });
  }

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
