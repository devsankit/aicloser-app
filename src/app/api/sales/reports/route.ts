import { NextResponse } from "next/server";

import { requireSessionRole } from "@/lib/api/require-session-role";
import { getSalesResponsibilityReport, parseSalesReportFilters } from "@/lib/gigxomi/sales-reporting";

export async function GET(request: Request) {
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
