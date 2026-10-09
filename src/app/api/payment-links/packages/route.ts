import { NextResponse } from "next/server";

import { requireSessionRole } from "@/lib/api/require-session-role";
import { listUpiPackages } from "@/lib/upi-payment-collection";

export async function GET() {
  const authorization = await requireSessionRole(["ADMIN"]);
  if (!authorization.ok) return authorization.response;
  const packages = await listUpiPackages();
  return NextResponse.json({ ok: true, packages: packages.map((item) => ({ ...item, amount: Number(item.amount) })) });
}
