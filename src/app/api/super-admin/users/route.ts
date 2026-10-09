import { NextResponse } from "next/server";

import { requireSessionRole } from "@/lib/api/require-session-role";
import { getSuperAdminPlatformSummary } from "@/lib/super-admin/platform-summary";

export async function GET() {
  const authorization = await requireSessionRole(["SUPER_ADMIN"]);
  if (!authorization.ok) return authorization.response;

  try {
    const summary = await getSuperAdminPlatformSummary();
    return NextResponse.json({ ok: true, businesses: summary.businesses, stats: summary.stats });
  } catch (error) {
    console.error("Super Admin platform summary fetch failed:", error);
    return NextResponse.json({ ok: false, error: "Failed to load platform summary." }, { status: 500 });
  }
}

export async function POST() {
  const authorization = await requireSessionRole(["SUPER_ADMIN"]);
  if (!authorization.ok) return authorization.response;
  return NextResponse.json({ ok: false, error: "Tenant users, seats, status, and payments are managed by the Tenant Admin." }, { status: 403 });
}
