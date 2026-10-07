import { NextResponse } from "next/server";
import { requireSessionRole } from "@/lib/api/require-session-role";
import { getCustomFields, upsertCustomField } from "@/lib/gigxomi/custom-fields-store";

export async function GET() {
  const auth = await requireSessionRole(["SALES_AGENT", "ADMIN", "SUPER_ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.response;

  try {
    const fields = await getCustomFields();
    return NextResponse.json({ ok: true, fields });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Failed to fetch custom fields" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireSessionRole(["ADMIN", "SUPER_ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    if (!body.name || !body.label || !body.type) {
      return NextResponse.json({ ok: false, error: "Field name, label, and type are required" }, { status: 400 });
    }
    const field = await upsertCustomField(body);
    return NextResponse.json({ ok: true, field });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Failed to create custom field" }, { status: 500 });
  }
}
