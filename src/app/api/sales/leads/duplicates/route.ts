import { NextResponse } from "next/server";
import { requireSessionRole } from "@/lib/api/require-session-role";
import { findDuplicateLeads } from "@/lib/gigxomi/lead-duplicates-store";
import { getSalesSnapshotForRole } from "@/lib/gigxomi/sales-store";
import { centralApiRequest } from "@/lib/central-api-server";

export async function GET() {
  try {
    const payload = await centralApiRequest<{ data?: unknown[] }>("/leads/duplicates");
    return NextResponse.json({ ok: true, clusters: payload.data ?? [] });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Central duplicate leads API unavailable." }, { status: 502 });
  }

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
