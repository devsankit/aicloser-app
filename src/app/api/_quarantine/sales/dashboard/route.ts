import { NextResponse } from "next/server";

import { requireSessionRole } from "@/lib/api/require-session-role";
import { getSalesSnapshotForRole } from "@/lib/gigxomi/sales-store";

export async function GET(request: Request) {
  const authorization = await requireSessionRole(["SUPER_ADMIN", "ADMIN", "MANAGER", "SALES_AGENT"]);
  if (!authorization.ok) return authorization.response;

  const url = new URL(request.url);
  const snapshot = await getSalesSnapshotForRole(authorization.session, url.searchParams.get("agentId"));
  return NextResponse.json({ ok: true, snapshot });
}
