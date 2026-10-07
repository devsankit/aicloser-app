import { NextResponse } from "next/server";
import { requireSessionRole } from "@/lib/api/require-session-role";
import { getMissedCalls, recordMissedCall } from "@/lib/gigxomi/missed-calls-store";

export async function GET() {
  const auth = await requireSessionRole(["SALES_AGENT", "ADMIN", "SUPER_ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.response;

  try {
    const calls = await getMissedCalls();
    return NextResponse.json({ ok: true, calls });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Failed to fetch missed calls" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireSessionRole(["SALES_AGENT", "ADMIN", "SUPER_ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    if (!body.callerNumber) {
      return NextResponse.json({ ok: false, error: "Caller number is required" }, { status: 400 });
    }
    const record = await recordMissedCall({
      ...body,
      agentId: auth.session.userId,
    });
    return NextResponse.json({ ok: true, call: record });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Failed to log missed call" }, { status: 500 });
  }
}
