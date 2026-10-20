import { NextResponse } from "next/server";
import { requireSessionRole } from "@/lib/api/require-session-role";
import { deleteWorkflowRule, upsertWorkflowRule } from "@/lib/gigxomi/automation-engine-store";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireSessionRole(["ADMIN", "SUPER_ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await context.params;
    const body = await request.json();
    const updated = await upsertWorkflowRule({ ...body, id });
    return NextResponse.json({ ok: true, rule: updated });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Failed to update rule" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireSessionRole(["ADMIN", "SUPER_ADMIN"]);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await context.params;
    await deleteWorkflowRule(id);
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Failed to delete rule" }, { status: 500 });
  }
}
