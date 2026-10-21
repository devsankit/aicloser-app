import { NextResponse } from "next/server";
import { CentralApiError, centralApiRequest } from "@/lib/central-api-server";

export async function GET(request: Request) {
  try {
    const query = new URL(request.url).searchParams.toString();
    const authHeader = request.headers.get("authorization");
    const payload = await centralApiRequest(`/leads${query ? `?${query}` : ""}`, {
      headers: authHeader ? { Authorization: authHeader } : undefined,
    });
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      { success: false, data: null, error: error instanceof Error ? error.message : "Central leads API unavailable." },
      { status: error instanceof CentralApiError ? error.status : 502 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const authHeader = request.headers.get("authorization");
    const payload = await centralApiRequest("/leads", {
      method: "POST",
      body: JSON.stringify(body),
      headers: authHeader ? { Authorization: authHeader } : undefined,
    });
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      { success: false, data: null, error: error instanceof Error ? error.message : "Failed to create lead in central API." },
      { status: error instanceof CentralApiError ? error.status : 500 },
    );
  }
}
