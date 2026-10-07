import { NextResponse } from "next/server";
import { requireSessionRole } from "@/lib/api/require-session-role";
import { getSalesForms, upsertSalesForm } from "@/lib/gigxomi/custom-fields-store";

export async function GET() {
  const auth = await requireSessionRole(["SALES_AGENT", "ADMIN", "SUPER_ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.response;

  try {
    const forms = await getSalesForms();
    return NextResponse.json({ ok: true, forms });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Failed to fetch sales forms" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireSessionRole(["ADMIN", "SUPER_ADMIN", "MANAGER", "SALES_AGENT"]);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    if (!body.title || !body.slug) {
      return NextResponse.json({ ok: false, error: "Title and URL slug are required" }, { status: 400 });
    }
    const form = await upsertSalesForm(body);
    return NextResponse.json({ ok: true, form });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Failed to create sales form" }, { status: 500 });
  }
}
