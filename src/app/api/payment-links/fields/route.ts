import { NextResponse } from "next/server";

import { requireSessionRole } from "@/lib/api/require-session-role";
import { getUpiSettings, saveUpiFieldPolicies, tenantForSession } from "@/lib/upi-payment-collection";

export async function GET(request: Request) {
  const authorization = await requireSessionRole(["ADMIN"]);
  if (!authorization.ok) return authorization.response;
  const tenantId = tenantForSession(authorization.session, new URL(request.url).searchParams.get("tenantId"));
  const result = await getUpiSettings(tenantId);
  return NextResponse.json({ ok: true, tenantId, policies: result.policies });
}

export async function PUT(request: Request) {
  const authorization = await requireSessionRole(["ADMIN"]);
  if (!authorization.ok) return authorization.response;
  try {
    const body = await request.json();
    const policies = await saveUpiFieldPolicies({ tenantId: tenantForSession(authorization.session, body.tenantId), policies: Array.isArray(body.policies) ? body.policies : [] });
    return NextResponse.json({ ok: true, policies });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Could not save field settings." }, { status: 400 });
  }
}
