import { NextResponse } from "next/server";
import { CentralApiError, centralApiRequest } from "@/lib/central-api-server";

export async function GET(request: Request) {
  try {
    const query = new URL(request.url).searchParams.toString();
    const payload = await centralApiRequest(`/leads${query ? `?${query}` : ""}`);
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      { success: false, data: null, error: error instanceof Error ? error.message : "Central leads API unavailable." },
      { status: error instanceof CentralApiError ? error.status : 502 },
    );
  }
}
