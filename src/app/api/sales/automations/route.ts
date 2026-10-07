import { NextResponse } from "next/server";
import { requireSessionRole } from "@/lib/api/require-session-role";
import { getWorkflowRules, upsertWorkflowRule } from "@/lib/gigxomi/automation-engine-store";

export async function GET() {
  const auth = await requireSessionRole(["SALES_AGENT", "ADMIN", "SUPER_ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.response;

  try {
    const rules = await getWorkflowRules();
    return NextResponse.json({ ok: true, rules });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Failed to load workflow rules" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireSessionRole(["ADMIN", "SUPER_ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    if (!body.name || !body.trigger?.type) {
      return NextResponse.json({ ok: false, error: "Rule name and trigger are required" }, { status: 400 });
    }
    const rule = await upsertWorkflowRule(body);
    return NextResponse.json({ ok: true, rule });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Failed to save workflow rule" }, { status: 500 });
  }
}
