import { NextResponse } from "next/server";
import { requireSessionRole } from "@/lib/api/require-session-role";
import { deleteSalesForm, upsertSalesForm } from "@/lib/gigxomi/custom-fields-store";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireSessionRole(["ADMIN", "SUPER_ADMIN", "MANAGER", "SALES_AGENT"]);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await context.params;
    const body = await request.json();
    const updated = await upsertSalesForm({ ...body, id });
    return NextResponse.json({ ok: true, form: updated });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Failed to update sales form" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireSessionRole(["ADMIN", "SUPER_ADMIN", "MANAGER", "SALES_AGENT"]);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await context.params;
    await deleteSalesForm(id);
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Failed to delete sales form" }, { status: 500 });
  }
}
