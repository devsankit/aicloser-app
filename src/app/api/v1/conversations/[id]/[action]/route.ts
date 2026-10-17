import { NextResponse } from "next/server";
import { CentralApiError, centralApiRequest } from "@/lib/central-api-server";

const SUPPORTED_GET_ACTIONS = new Set(["messages"]);
const SUPPORTED_POST_ACTIONS = new Set(["messages", "read", "typing", "notes", "callback", "drip"]);
const SUPPORTED_PATCH_ACTIONS = new Set(["stage"]);

export async function GET(request: Request, context: { params: Promise<{ id: string; action: string }> }) {
  const { id, action } = await context.params;
  if (!SUPPORTED_GET_ACTIONS.has(action)) {
    return NextResponse.json({ success: false, data: null, error: "Unsupported conversation action." }, { status: 404 });
  }
  try {
    const query = new URL(request.url).searchParams.toString();
    const payload = await centralApiRequest(`/conversations/${encodeURIComponent(id)}/${action}${query ? `?${query}` : ""}`);
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      { success: false, data: null, error: error instanceof Error ? error.message : "Central conversation API unavailable." },
      { status: error instanceof CentralApiError ? error.status : 502 },
    );
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string; action: string }> }) {
  const { id, action } = await context.params;
  if (!SUPPORTED_POST_ACTIONS.has(action)) {
    return NextResponse.json({ success: false, data: null, error: "Unsupported conversation action." }, { status: 404 });
  }
  try {
    const body = action === "read" ? undefined : await request.json().catch(() => ({}));
    const payload = await centralApiRequest(`/conversations/${encodeURIComponent(id)}/${action}`, {
      method: "POST",
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      { success: false, data: null, error: error instanceof Error ? error.message : "Central conversation API unavailable." },
      { status: error instanceof CentralApiError ? error.status : 502 },
    );
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string; action: string }> }) {
  const { id, action } = await context.params;
  if (!SUPPORTED_PATCH_ACTIONS.has(action)) {
    return NextResponse.json({ success: false, data: null, error: "Unsupported conversation action." }, { status: 404 });
  }
  try {
    const body = await request.json().catch(() => ({}));
    const payload = await centralApiRequest(`/conversations/${encodeURIComponent(id)}/${action}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      { success: false, data: null, error: error instanceof Error ? error.message : "Central conversation API unavailable." },
      { status: error instanceof CentralApiError ? error.status : 502 },
    );
  }
}
