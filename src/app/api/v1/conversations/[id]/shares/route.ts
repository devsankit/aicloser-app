import { NextResponse } from "next/server";
import { CentralApiError, centralApiRequest } from "@/lib/central-api-server";

function errorResponse(error: unknown) {
  return NextResponse.json(
    { success: false, data: null, error: error instanceof Error ? error.message : "Central conversation API unavailable." },
    { status: error instanceof CentralApiError ? error.status : 502 },
  );
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    return NextResponse.json(await centralApiRequest(`/conversations/${encodeURIComponent(id)}/shares`));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  try {
    return NextResponse.json(await centralApiRequest(`/conversations/${encodeURIComponent(id)}/shares`, {
      method: "POST",
      body: JSON.stringify(body),
    }));
  } catch (error) {
    return errorResponse(error);
  }
}
