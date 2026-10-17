import { NextResponse } from "next/server";

import { requireSessionRole } from "@/lib/api/require-session-role";
import { getSalesResponsibilityReport, parseSalesReportFilters } from "@/lib/gigxomi/sales-reporting";
import { centralApiRequest } from "@/lib/central-api-server";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const query = new URLSearchParams();
    for (const key of ["from", "to", "startDate", "endDate"]) {
      const value = url.searchParams.get(key);
      if (value) query.set(key === "startDate" ? "from" : key === "endDate" ? "to" : key, value);
    }
    const payload = await centralApiRequest<{ data?: Record<string, unknown> }>(`/reports/overview${query.size ? `?${query.toString()}` : ""}`);
    const report = payload.data ?? {};
    return NextResponse.json({ ok: true, report, reports: report, funnel: report.funnel ?? [], leaderboard: report.leaderboard ?? report.team ?? [] });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Central reports API unavailable." }, { status: 502 });
  }

  const authorization = await requireSessionRole(["SUPER_ADMIN", "ADMIN", "MANAGER", "SALES_AGENT"]);
  if (!authorization.ok) return authorization.response;
  const url = new URL(request.url);
  const filters = parseSalesReportFilters(url.searchParams);
  const report = await getSalesResponsibilityReport(authorization.session, filters);
  return NextResponse.json({
    ok: true,
    report,
    reports: report,
    funnel: report.funnel,
    leaderboard: report.team,
  });
}
