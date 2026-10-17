import { NextResponse } from "next/server";
import { requireSessionRole } from "@/lib/api/require-session-role";
import { mergeLeads } from "@/lib/gigxomi/lead-duplicates-store";
import { getSalesSnapshotForRole } from "@/lib/gigxomi/sales-store";
import { centralApiRequest } from "@/lib/central-api-server";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const payload = await centralApiRequest("/leads/merge", {
      method: "POST",
      body: JSON.stringify({ primaryLeadId: body.primaryLeadId, secondaryLeadId: body.secondaryLeadId }),
    });
    return NextResponse.json({ ok: true, ...(payload as Record<string, unknown>) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Central merge API unavailable." }, { status: 502 });
  }

  const auth = await requireSessionRole(["ADMIN", "SUPER_ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    if (!body.primaryLeadId || !body.secondaryLeadId) {
      return NextResponse.json({ ok: false, error: "primaryLeadId and secondaryLeadId are required" }, { status: 400 });
    }
    const snapshot = await getSalesSnapshotForRole(auth.session);
    const visibleLeadIds = new Set(snapshot.visibleLeads.map((lead) => lead.id));
    const result = await mergeLeads(String(body.primaryLeadId), String(body.secondaryLeadId), visibleLeadIds);
    return NextResponse.json(result);
  } catch (error: any) {
    const message = error?.message || "Failed to merge leads";
    const status = message.includes("access") ? 403 : message.includes("different workspaces") ? 422 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
