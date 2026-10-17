import { NextResponse } from "next/server";
import { CentralApiError, centralApiRequest } from "@/lib/central-api-server";

export async function GET() {
  try {
    const payload = await centralApiRequest("/leads/pool");
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      { success: false, data: null, error: error instanceof Error ? error.message : "Central lead pool API unavailable." },
      { status: error instanceof CentralApiError ? error.status : 502 },
    );
  }
}
