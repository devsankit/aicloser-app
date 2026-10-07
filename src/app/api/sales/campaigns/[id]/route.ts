import { NextResponse } from "next/server";
import { requireSessionRole } from "@/lib/api/require-session-role";
import { deleteCallingCampaign, getCampaignById, upsertCallingCampaign } from "@/lib/gigxomi/calling-campaigns-store";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireSessionRole(["SALES_AGENT", "ADMIN", "SUPER_ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await context.params;
    const campaign = await getCampaignById(id);
    if (!campaign) {
      return NextResponse.json({ ok: false, error: "Campaign not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, campaign });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Failed to load campaign" }, { status: 500 });
  }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireSessionRole(["ADMIN", "SUPER_ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await context.params;
    const body = await request.json();
    const updated = await upsertCallingCampaign({ ...body, id });
    return NextResponse.json({ ok: true, campaign: updated });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Failed to update campaign" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireSessionRole(["ADMIN", "SUPER_ADMIN"]);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await context.params;
    await deleteCallingCampaign(id);
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Failed to delete campaign" }, { status: 500 });
  }
}
