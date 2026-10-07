import { NextResponse } from "next/server";
import { requireSessionRole } from "@/lib/api/require-session-role";
import { getHourlyCallDistribution, getAgentProductivityLeaderboard, getSourcePerformance } from "@/lib/gigxomi/advanced-reports-store";

export async function GET() {
  const auth = await requireSessionRole(["SALES_AGENT", "ADMIN", "SUPER_ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.response;

  try {
    const [hourly, leaderboard, sources] = await Promise.all([
      getHourlyCallDistribution(),
      getAgentProductivityLeaderboard(),
      getSourcePerformance(),
    ]);
    return NextResponse.json({
      ok: true,
      hourly,
      leaderboard,
      sources,
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Failed to load custom reports" }, { status: 500 });
  }
}
