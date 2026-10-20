import { NextResponse } from "next/server";
import { requireSessionRole } from "@/lib/api/require-session-role";
import { deleteCustomField, upsertCustomField } from "@/lib/gigxomi/custom-fields-store";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireSessionRole(["ADMIN", "SUPER_ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await context.params;
    const body = await request.json();
    const updated = await upsertCustomField({ ...body, id });
    return NextResponse.json({ ok: true, field: updated });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Failed to update custom field" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireSessionRole(["ADMIN", "SUPER_ADMIN"]);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await context.params;
    await deleteCustomField(id);
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Failed to delete custom field" }, { status: 500 });
  }
}
