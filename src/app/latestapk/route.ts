import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const downloadUrl = new URL("/downloads/aicloser-latest.apk", url.origin);
  
  return NextResponse.redirect(downloadUrl, {
    status: 307,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "Content-Disposition": 'attachment; filename="aicloser-latest.apk"',
    },
  });
}
