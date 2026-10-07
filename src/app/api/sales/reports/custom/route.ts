import { NextResponse } from "next/server";
import { requireSessionRole } from "@/lib/api/require-session-role";
import { getHourlyCallDistribution, getAgentProductivityLeaderboard, getSourcePerformance } from "@/lib/gigxomi/advanced-reports-store";
import { getSalesSnapshotForRole } from "@/lib/gigxomi/sales-store";

export async function GET(request: Request) {
  const auth = await requireSessionRole(["SALES_AGENT", "ADMIN", "SUPER_ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.response;

  try {
    const url = new URL(request.url);
    const requestedAgentId = url.searchParams.get("agentId")?.trim() || null;
    const snapshot = await getSalesSnapshotForRole(auth.session);
    const selectedAgent = requestedAgentId
      ? snapshot.visibleAgents.find((agent) => agent.id === requestedAgentId) ?? null
      : null;
    const agentId = selectedAgent?.id ?? null;
    const [hourly, leaderboard, sources] = await Promise.all([
      getHourlyCallDistribution(agentId),
      getAgentProductivityLeaderboard(agentId),
      getSourcePerformance(agentId),
    ]);
    return NextResponse.json({
      ok: true,
      hourly,
      leaderboard,
      sources,
      viewingAgent: selectedAgent ? { id: selectedAgent.id, name: selectedAgent.displayName } : null,
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Failed to load custom reports" }, { status: 500 });
  }
}
