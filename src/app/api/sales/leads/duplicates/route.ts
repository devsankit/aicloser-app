import { NextResponse } from "next/server";
import { requireSessionRole } from "@/lib/api/require-session-role";
import { findDuplicateLeads } from "@/lib/gigxomi/lead-duplicates-store";

export async function GET() {
  const auth = await requireSessionRole(["SALES_AGENT", "ADMIN", "SUPER_ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.response;

  try {
    const clusters = await findDuplicateLeads();
    return NextResponse.json({ ok: true, clusters });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Failed to scan duplicates" }, { status: 500 });
  }
}
