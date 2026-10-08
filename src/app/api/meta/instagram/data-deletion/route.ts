import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { getPublicRequestUrl } from "@/lib/auth/request-url";
import {
  disconnectInstagramConnection,
  findInstagramConnectionForSignedRequest,
  readInstagramSignedRequest,
  verifyInstagramSignedRequest,
} from "@/lib/meta/instagram-callback";

export async function POST(request: Request) {
  const appSecret = process.env.INSTAGRAM_OAUTH_CLIENT_SECRET?.trim() || process.env.INSTAGRAM_APP_SECRET?.trim();
  if (!appSecret) return NextResponse.json({ error: "Instagram data deletion callback is not configured." }, { status: 503 });

  try {
    const signedRequest = await readInstagramSignedRequest(request);
    const payload = verifyInstagramSignedRequest(signedRequest, appSecret);
    const connection = await findInstagramConnectionForSignedRequest(payload);
    if (!connection) return NextResponse.json({ error: "Instagram account was not found." }, { status: 404 });
    await disconnectInstagramConnection(connection, "Instagram data deletion request received from Meta.");
    const confirmationCode = `IG-${randomUUID().replace(/-/g, "").slice(0, 16).toUpperCase()}`;
    const statusUrl = getPublicRequestUrl(request, `/?tab=instagram-inbox&deletion=${encodeURIComponent(confirmationCode)}`).toString();
    return NextResponse.json({ url: statusUrl, confirmation_code: confirmationCode });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid Instagram data deletion request." }, { status: 401 });
  }
}
