import { NextResponse } from "next/server";
import { requireSessionRole } from "@/lib/api/require-session-role";
import { mergeLeads } from "@/lib/gigxomi/lead-duplicates-store";

export async function POST(request: Request) {
  const auth = await requireSessionRole(["ADMIN", "SUPER_ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    if (!body.primaryLeadId || !body.secondaryLeadId) {
      return NextResponse.json({ ok: false, error: "primaryLeadId and secondaryLeadId are required" }, { status: 400 });
    }
    const result = await mergeLeads(body.primaryLeadId, body.secondaryLeadId);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Failed to merge leads" }, { status: 500 });
  }
}
