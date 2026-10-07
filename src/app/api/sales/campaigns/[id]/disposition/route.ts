import { NextResponse } from "next/server";
import { requireSessionRole } from "@/lib/api/require-session-role";
import { submitCallDisposition } from "@/lib/gigxomi/calling-campaigns-store";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireSessionRole(["SALES_AGENT", "ADMIN", "SUPER_ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await context.params;
    const body = await request.json();
    if (!body.leadId || !body.disposition) {
      return NextResponse.json({ ok: false, error: "leadId and disposition are required" }, { status: 400 });
    }
    const result = await submitCallDisposition(id, body.leadId, {
      disposition: body.disposition,
      notes: body.notes,
      agentId: auth.session.userId,
      durationSeconds: body.durationSeconds,
    });
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Failed to submit disposition" }, { status: 500 });
  }
}
