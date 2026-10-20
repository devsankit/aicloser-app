import { NextResponse } from "next/server";
import { requireSessionRole } from "@/lib/api/require-session-role";
import { executeCampaignQueueWorker } from "@/lib/whatsapp-marketing/campaign-engine";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireSessionRole(["SUPER_ADMIN", "ADMIN", "SALES_AGENT"]);
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  const batchLimit = body?.batchLimit ? Number(body.batchLimit) : 50;
  const dispatchRate = body?.dispatchRate ? Number(body.dispatchRate) : undefined;

  const result = await executeCampaignQueueWorker(id, {
    batchLimit,
    dispatchRate,
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
