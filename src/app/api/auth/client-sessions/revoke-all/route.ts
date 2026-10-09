import { NextResponse } from "next/server";

import { authenticatePassword, findUserByIdentifier } from "@/lib/auth/store";
import { revokeAllActiveAppClientSessions } from "@/lib/auth/client-sessions";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const identifier = String(body.identifier ?? "").trim();
  const password = String(body.password ?? "").trim();

  if (!identifier || !password) {
    return NextResponse.json({ ok: false, error: "Identifier and password are required." }, { status: 400 });
  }

  const resolvedUser = await findUserByIdentifier(identifier);
  if (resolvedUser?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ ok: false, error: "Only the authorized super-admin account can revoke all sessions." }, { status: 403 });
  }

  const user = await authenticatePassword(identifier, password, { updateLastLogin: false });
  if (!user || user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ ok: false, error: "Invalid email or password." }, { status: 401 });
  }

  const revokedSessions = await revokeAllActiveAppClientSessions({
    userId: user.id,
    tenantId: user.tenantId,
    reason: "Revoked all sessions from the super-admin login screen",
  });
  return NextResponse.json({ ok: true, revokedSessions });
}
