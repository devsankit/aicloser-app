import { NextResponse } from "next/server";
import { requireSessionRole } from "@/lib/api/require-session-role";
import { centralApiRequest } from "@/lib/central-api-server";
import { getStageConfigs, saveStageConfigs } from "@/lib/gigxomi/custom-fields-store";

export async function GET() {
  const auth = await requireSessionRole(["SALES_AGENT", "ADMIN", "SUPER_ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.response;

  try {
    // Primary: fetch dynamic workspace stages from central API
    const centralRes = await centralApiRequest<any>("/stages").catch(() => null);
    if (centralRes && centralRes.success && (Array.isArray(centralRes.data) || Array.isArray(centralRes.stages))) {
      const stages = Array.isArray(centralRes.data) ? centralRes.data : centralRes.stages;
      if (stages.length > 0) {
        return NextResponse.json({ ok: true, success: true, data: stages, stages });
      }
    }

    const stages = await getStageConfigs();
    return NextResponse.json({ ok: true, success: true, data: stages, stages });
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
    await centralApiRequest("/stages", { method: "PUT", body }).catch(() => null);
    await saveStageConfigs(body).catch(() => null);
    return NextResponse.json({ ok: true, stages: body });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Failed to update stage configs" }, { status: 500 });
  }
}
