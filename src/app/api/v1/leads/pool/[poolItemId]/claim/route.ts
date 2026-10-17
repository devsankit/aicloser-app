import { NextResponse } from "next/server";

import { CentralApiError, centralApiRequest } from "@/lib/central-api-server";

export async function POST(
  request: Request,
  context: { params: Promise<{ poolItemId: string }> },
) {
  try {
    const { poolItemId } = await context.params;
    const body = await request.text();
    const payload = await centralApiRequest(`/leads/pool/${encodeURIComponent(poolItemId)}/claim`, {
      method: "POST",
      ...(body ? { body } : {}),
    });
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      { success: false, data: null, error: error instanceof Error ? error.message : "Unable to claim lead." },
      { status: error instanceof CentralApiError ? error.status : 502 },
    );
  }
}
