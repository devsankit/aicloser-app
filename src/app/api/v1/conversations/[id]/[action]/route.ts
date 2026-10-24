import { NextResponse } from "next/server";
import { CentralApiError, centralApiRequest } from "@/lib/central-api-server";

function isValidAction(action: string): boolean {
  return Boolean(action && /^[a-zA-Z0-9_-]+$/.test(action));
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string; action: string }> }) {
  const { id, action } = await context.params;
  if (!isValidAction(action)) {
    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  }
  try {
    const query = new URL(request.url).searchParams.toString();
    const payload = await centralApiRequest(`/conversations/${encodeURIComponent(id)}/${encodeURIComponent(action)}${query ? `?${query}` : ""}`, {
      method: "DELETE",
    });
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unable to delete conversation action" },
      { status: error instanceof CentralApiError ? error.status : 502 },
    );
  }
}

export async function GET(request: Request, context: { params: Promise<{ id: string; action: string }> }) {
  const { id, action } = await context.params;
  if (!isValidAction(action)) {
    return NextResponse.json({ success: false, data: null, error: "Invalid conversation action." }, { status: 400 });
  }
  try {
    const query = new URL(request.url).searchParams.toString();
    const payload = await centralApiRequest(`/conversations/${encodeURIComponent(id)}/${encodeURIComponent(action)}${query ? `?${query}` : ""}`);
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
  if (!isValidAction(action)) {
    return NextResponse.json({ success: false, data: null, error: "Invalid conversation action." }, { status: 400 });
  }
  try {
    const body = action === "read" ? undefined : await request.json().catch(() => ({}));
    const payload = await centralApiRequest(`/conversations/${encodeURIComponent(id)}/${encodeURIComponent(action)}`, {
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
  if (!isValidAction(action)) {
    return NextResponse.json({ success: false, data: null, error: "Invalid conversation action." }, { status: 400 });
  }
  try {
    const body = await request.json().catch(() => ({}));
    const payload = await centralApiRequest(`/conversations/${encodeURIComponent(id)}/${encodeURIComponent(action)}`, {
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
