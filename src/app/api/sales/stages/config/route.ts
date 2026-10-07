import { NextResponse } from "next/server";
import { requireSessionRole } from "@/lib/api/require-session-role";
import { getStageConfigs, saveStageConfigs } from "@/lib/gigxomi/custom-fields-store";

export async function GET() {
  const auth = await requireSessionRole(["SALES_AGENT", "ADMIN", "SUPER_ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.response;

  try {
    const stages = await getStageConfigs();
    return NextResponse.json({ ok: true, stages });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Failed to load stage configs" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const auth = await requireSessionRole(["ADMIN", "SUPER_ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    if (!Array.isArray(body)) {
      return NextResponse.json({ ok: false, error: "Expected an array of stage configurations" }, { status: 400 });
    }
    await saveStageConfigs(body);
    return NextResponse.json({ ok: true, stages: body });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Failed to update stage configs" }, { status: 500 });
  }
}
