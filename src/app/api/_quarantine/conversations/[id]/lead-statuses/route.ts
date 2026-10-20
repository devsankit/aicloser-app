import { NextResponse } from "next/server";

import { requireSessionRole } from "@/lib/api/require-session-role";
import { crmStatuses } from "@/lib/gigxomi/crm-data";
import { centralApiRequest } from "@/lib/central-api-server";

export async function GET() {
  const authorization = await requireSessionRole(["SUPER_ADMIN", "ADMIN", "MANAGER", "SALES_AGENT"]);
  if (!authorization.ok) {
    return authorization.response;
  }

  try {
    const payload = await centralApiRequest<{ data: unknown[] }>("/stages");
    if (Array.isArray(payload.data) && payload.data.length > 0) {
      return NextResponse.json({ ok: true, statuses: payload.data });
    }
  } catch {
    // Proceed to fallback
  }

  return NextResponse.json({
    ok: true,
    statuses: crmStatuses.map((status) => ({
      id: status.id,
      label: status.label,
      tone: status.tone,
      order: status.order,
      active: status.active,
    })),
  });
}

export async function POST(request: Request) {
  const authorization = await requireSessionRole(["SUPER_ADMIN", "ADMIN", "MANAGER", "SALES_AGENT"]);
  if (!authorization.ok) {
    return authorization.response;
  }

  const body = await request.json().catch(() => ({}));

  try {
    const payload = await centralApiRequest<{ data: unknown }>("/stages", {
      method: "POST",
      body: JSON.stringify(body),
    });
    return NextResponse.json({ ok: true, ...(payload as Record<string, unknown>) });
  } catch {
    return NextResponse.json({
      ok: true,
      statuses: crmStatuses,
    });
  }
}
