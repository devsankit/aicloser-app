import { NextResponse } from "next/server";
import { requireSessionRole } from "@/lib/api/require-session-role";
import { findDuplicateLeads } from "@/lib/gigxomi/lead-duplicates-store";
import { getSalesSnapshotForRole } from "@/lib/gigxomi/sales-store";

export async function GET() {
  const auth = await requireSessionRole(["ADMIN", "SUPER_ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.response;

  try {
    const snapshot = await getSalesSnapshotForRole(auth.session);
    const clusters = await findDuplicateLeads(snapshot.visibleLeads);
    return NextResponse.json({ ok: true, clusters });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Failed to scan duplicates" }, { status: 500 });
  }
}
