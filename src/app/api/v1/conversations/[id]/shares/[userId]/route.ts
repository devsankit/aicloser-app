import { NextResponse } from "next/server";
import { CentralApiError, centralApiRequest } from "@/lib/central-api-server";

export async function DELETE(_request: Request, context: { params: Promise<{ id: string; userId: string }> }) {
  const { id, userId } = await context.params;
  try {
    return NextResponse.json(await centralApiRequest(
      `/conversations/${encodeURIComponent(id)}/shares/${encodeURIComponent(userId)}`,
      { method: "DELETE" },
    ));
  } catch (error) {
    return NextResponse.json(
      { success: false, data: null, error: error instanceof Error ? error.message : "Central conversation API unavailable." },
      { status: error instanceof CentralApiError ? error.status : 502 },
    );
  }
}
