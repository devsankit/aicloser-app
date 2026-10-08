import { NextResponse } from "next/server";

import { requireSessionRole } from "@/lib/api/require-session-role";
import { getSalesSnapshotForRole } from "@/lib/gigxomi/sales-store";
import { getGxCustomer360 } from "@/lib/gxclosers/customer-360";

export async function GET(_request: Request, context: { params: Promise<{ leadId: string }> }) {
  const authorization = await requireSessionRole(["SUPER_ADMIN", "ADMIN", "MANAGER", "SALES_AGENT"]);
  if (!authorization.ok) return authorization.response;
  const { leadId } = await context.params;
  const snapshot = await getSalesSnapshotForRole(authorization.session);
  if (!snapshot.visibleLeads.some((lead) => lead.id === leadId)) {
    return NextResponse.json({ ok: false, error: "Lead not found." }, { status: 404 });
  }
  const customer360 = await getGxCustomer360(leadId);
  return customer360 ? NextResponse.json({ ok: true, customer360 }) : NextResponse.json({ ok: false, error: "Lead not found." }, { status: 404 });
}
