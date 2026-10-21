import { NextResponse } from "next/server";

import { requireSessionRole } from "@/lib/api/require-session-role";
import { setAuthenticatedUserPassword } from "@/lib/auth/store";

export async function POST(request: Request) {
  const authorization = await requireSessionRole(["SALES_AGENT", "MANAGER", "ADMIN"]);
  if (!authorization.ok) return authorization.response;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const currentPassword = typeof body?.currentPassword === "string" ? body.currentPassword : "";
  const password = String(body?.password ?? "");
  const confirmPassword = String(body?.confirmPassword ?? "");
  if (password !== confirmPassword) {
    return NextResponse.json({ ok: false, error: "Passwords do not match." }, { status: 400 });
  }

  const result = await setAuthenticatedUserPassword(authorization.session.userId, password, currentPassword);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
