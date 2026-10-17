import { NextResponse } from "next/server";
import { centralApiRequest } from "@/lib/central-api-server";

export async function GET() {
  try {
    const centralRes = await centralApiRequest<any>("/stages");
    return NextResponse.json(centralRes);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to load stages from central API" },
      { status: error?.status || 500 }
    );
  }
}
