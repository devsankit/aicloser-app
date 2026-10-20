import { NextResponse } from "next/server";
import { requireSessionRole } from "@/lib/api/require-session-role";
import { getLeadCustomValues, saveLeadCustomValues } from "@/lib/gigxomi/custom-fields-store";

export async function GET(_request: Request, context: { params: Promise<{ leadId: string }> }) {
  const auth = await requireSessionRole(["SALES_AGENT", "ADMIN", "SUPER_ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.response;

  try {
    const { leadId } = await context.params;
    const values = await getLeadCustomValues(leadId);
    return NextResponse.json({ ok: true, values });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Failed to load lead custom values" }, { status: 500 });
  }
}

export async function PUT(request: Request, context: { params: Promise<{ leadId: string }> }) {
  const auth = await requireSessionRole(["SALES_AGENT", "ADMIN", "SUPER_ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.response;

  try {
    const { leadId } = await context.params;
    const body = await request.json();
    const updated = await saveLeadCustomValues(leadId, body);
    return NextResponse.json({ ok: true, values: updated });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Failed to save lead custom values" }, { status: 500 });
  }
}
