import { NextResponse } from "next/server";
import { requireSessionRole } from "@/lib/api/require-session-role";
import { executeNaturalLanguageQuery } from "@/lib/gigxomi/lead-iq-store";

export async function POST(request: Request) {
  const auth = await requireSessionRole(["SALES_AGENT", "ADMIN", "SUPER_ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    if (!body.query) {
      return NextResponse.json({ ok: false, error: "Query is required" }, { status: 400 });
    }
    const result = await executeNaturalLanguageQuery(body.query);
    return NextResponse.json({ ok: true, result });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Failed to process query" }, { status: 500 });
  }
}
