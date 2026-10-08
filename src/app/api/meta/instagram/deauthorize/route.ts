import { NextResponse } from "next/server";

import {
  disconnectInstagramConnection,
  findInstagramConnectionForSignedRequest,
  readInstagramSignedRequest,
  verifyInstagramSignedRequest,
} from "@/lib/meta/instagram-callback";

export async function POST(request: Request) {
  const appSecret = process.env.INSTAGRAM_OAUTH_CLIENT_SECRET?.trim() || process.env.INSTAGRAM_APP_SECRET?.trim();
  if (!appSecret) return NextResponse.json({ error: "Instagram deauthorize callback is not configured." }, { status: 503 });

  try {
    const signedRequest = await readInstagramSignedRequest(request);
    const payload = verifyInstagramSignedRequest(signedRequest, appSecret);
    const connection = await findInstagramConnectionForSignedRequest(payload);
    if (!connection) return NextResponse.json({ error: "Instagram account was not found." }, { status: 404 });
    await disconnectInstagramConnection(connection, "Instagram account was deauthorized by Meta.");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid Instagram deauthorize request." }, { status: 401 });
  }
}
