import { NextResponse } from "next/server";
import { requireSessionRole } from "@/lib/api/require-session-role";
import { resolveSessionTenantId } from "@/lib/api/resolve-session-tenant";
import { getCallingCampaigns, upsertCallingCampaign } from "@/lib/gigxomi/calling-campaigns-store";

export async function GET(request: Request) {
  const auth = await requireSessionRole(["SALES_AGENT", "ADMIN", "SUPER_ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.response;

  try {
    const tenantId = resolveSessionTenantId(auth.session, new URL(request.url).searchParams.get("tenantId"));
    const campaigns = await getCallingCampaigns(tenantId);
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
    const tenantId = resolveSessionTenantId(auth.session, body.tenantId);
    const campaign = await upsertCallingCampaign({ ...body, tenantId });
    return NextResponse.json({ ok: true, campaign });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Failed to create campaign" }, { status: 500 });
  }
}
