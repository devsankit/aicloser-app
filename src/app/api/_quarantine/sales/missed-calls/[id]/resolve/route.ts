import { NextResponse } from "next/server";
import { requireSessionRole } from "@/lib/api/require-session-role";
import { resolveMissedCall } from "@/lib/gigxomi/missed-calls-store";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireSessionRole(["SALES_AGENT", "ADMIN", "SUPER_ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const call = await resolveMissedCall(id, auth.session.userId, body.notes);
    return NextResponse.json({ ok: true, call });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Failed to resolve missed call" }, { status: 500 });
  }
}
