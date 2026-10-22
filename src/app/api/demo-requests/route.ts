import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    return NextResponse.json({
      success: true,
      ok: true,
      message: "Demo request received successfully. Our sales team will connect within 15 minutes.",
      data: body,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, ok: false, error: err?.message || "Invalid demo request payload" },
      { status: 400 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
