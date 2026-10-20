import { NextResponse } from "next/server";
import { processIncomingWebhook } from "@/lib/gigxomi/automation-engine-store";

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Webhook-Secret",
    },
  });
}

export async function POST(request: Request, context: { params: Promise<{ endpointKey: string }> }) {
  try {
    const { endpointKey } = await context.params;
    const body = await request.json().catch(() => ({}));
    const result = await processIncomingWebhook(endpointKey, body);
    return NextResponse.json(
      { ok: true, lead: result },
      {
        status: 200,
        headers: { "Access-Control-Allow-Origin": "*" },
      }
    );
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to process webhook" },
      {
        status: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
      }
    );
  }
}
