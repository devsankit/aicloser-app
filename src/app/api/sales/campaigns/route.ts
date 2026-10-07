import { NextResponse } from "next/server";
import { requireSessionRole } from "@/lib/api/require-session-role";
import { getCallingCampaigns, upsertCallingCampaign } from "@/lib/gigxomi/calling-campaigns-store";

export async function GET() {
  const auth = await requireSessionRole(["SALES_AGENT", "ADMIN", "SUPER_ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.response;

  try {
    const campaigns = await getCallingCampaigns();
    return NextResponse.json({ ok: true, campaigns });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Failed to load campaigns" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireSessionRole(["ADMIN", "SUPER_ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    if (!body.name) {
      return NextResponse.json({ ok: false, error: "Campaign name is required" }, { status: 400 });
    }
    const campaign = await upsertCallingCampaign(body);
    return NextResponse.json({ ok: true, campaign });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Failed to create campaign" }, { status: 500 });
  }
}
