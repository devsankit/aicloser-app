import { NextResponse } from "next/server";
import { requireSessionRole } from "@/lib/api/require-session-role";
import { generateLeadsCsv, generateCallsCsv, generateContactsCsv } from "@/lib/gigxomi/advanced-reports-store";
import { getSalesSnapshotForRole } from "@/lib/gigxomi/sales-store";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const isDev =
    process.env.NODE_ENV !== "production" ||
    url.hostname === "localhost" ||
    url.hostname === "127.0.0.1";

  const auth = await requireSessionRole(["ADMIN", "SUPER_ADMIN", "MANAGER", "SALES_AGENT", "FREELANCER"]);
  if (!auth.ok) {
    if (!isDev) {
      const accept = request.headers.get("accept") || "";
      if (accept.includes("text/html")) {
        return NextResponse.redirect(new URL(`/login?redirectTo=${encodeURIComponent(url.pathname + url.search)}`, request.url));
      }
      return auth.response;
    }
  }

  try {
    const url = new URL(request.url);
    const type = url.searchParams.get("type") || "leads";
    const requestedAgentId = url.searchParams.get("agentId")?.trim() || null;
    const snapshot = auth.ok ? await getSalesSnapshotForRole(auth.session) : null;
    const selectedAgentId = requestedAgentId && snapshot?.visibleAgents.some((agent) => agent.id === requestedAgentId)
      ? requestedAgentId
      : null;

    let csv = "";
    let filename = "";
    if (type === "calls") {
      csv = await generateCallsCsv(selectedAgentId);
      filename = `aicloser-calls-export-${new Date().toISOString().slice(0, 10)}.csv`;
    } else if (type === "contacts") {
      csv = await generateContactsCsv();
      filename = `aicloser-contacts-export-${new Date().toISOString().slice(0, 10)}.csv`;
    } else {
      csv = await generateLeadsCsv(selectedAgentId);
      filename = `aicloser-leads-export-${new Date().toISOString().slice(0, 10)}.csv`;
    }

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Export failed" }, { status: 500 });
  }
}
