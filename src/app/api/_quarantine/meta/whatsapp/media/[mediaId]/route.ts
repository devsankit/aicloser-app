import { NextRequest, NextResponse } from "next/server";

import { cookies } from "next/headers";

import { centralApiBaseUrl } from "@/lib/central-api-server";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ mediaId: string }> },
) {
  // Attachments belong to the live Central API workspace. Keep this proxy
  // independent from the optional local Prisma snapshot and forward the same
  // central bearer cookie used by the chat API.
  const cookieStore = await cookies();
  const authorizationHeader = request.headers.get("authorization")?.trim() || "";
  const bearerToken = authorizationHeader.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  const queryToken = request.nextUrl.searchParams.get("token")?.trim();
  const centralToken =
    bearerToken ||
    cookieStore.get("aicloser_token")?.value?.trim() ||
    cookieStore.get("access_token")?.value?.trim() ||
    cookieStore.get("central_access_token")?.value?.trim() ||
    queryToken ||
    "";
  if (!centralToken) {
    return NextResponse.json({ ok: false, error: "Authentication required." }, { status: 401 });
  }

  const { mediaId } = await context.params;
  const normalizedMediaId = decodeURIComponent(String(mediaId ?? "").trim());
  const fileName = (request.nextUrl.searchParams.get("fileName")?.trim() || "whatsapp-media").replace(/["\r\n]/g, "");

  if (!normalizedMediaId) {
    return NextResponse.json({ ok: false, error: "Media ID is required." }, { status: 400 });
  }

  const mediaParams = new URLSearchParams();
  const requestedMimeType = request.nextUrl.searchParams.get("mimeType")?.trim();
  if (requestedMimeType) mediaParams.set("mimeType", requestedMimeType);
  if (fileName) mediaParams.set("fileName", fileName);
  const range = request.headers.get("range");
  const upstreamResponse = await fetch(
    `${centralApiBaseUrl()}/integrations/whatsapp/media/${encodeURIComponent(normalizedMediaId)}${mediaParams.size ? `?${mediaParams}` : ""}`,
    {
      headers: {
        Authorization: `Bearer ${centralToken}`,
        Accept: requestedMimeType || "*/*",
        ...(range ? { Range: range } : {}),
      },
      cache: "no-store",
    },
  );

  if (!upstreamResponse.ok) {
    const details = await upstreamResponse.text().catch(() => "");
    return NextResponse.json(
      { ok: false, error: details || "Unable to download the WhatsApp media file." },
      { status: upstreamResponse.status || 502 },
    );
  }

  let mediaResponse = upstreamResponse;
  let resolvedMimeType = requestedMimeType || "application/octet-stream";
  const upstreamContentType = upstreamResponse.headers.get("content-type")?.toLowerCase() || "";

  // Some live API deployments return a short-lived Meta URL while newer ones
  // stream the media directly. Support both responses so the UI stays
  // compatible during backend rollouts.
  if (upstreamContentType.includes("application/json")) {
    const descriptor = (await upstreamResponse.json().catch(() => null)) as
      | { data?: { url?: string; mimeType?: string; mime_type?: string } }
      | null;
    const downloadUrl = String(descriptor?.data?.url ?? "").trim();
    resolvedMimeType = String(
      descriptor?.data?.mimeType ?? descriptor?.data?.mime_type ?? requestedMimeType ?? "application/octet-stream",
    ).trim();

    if (!downloadUrl) {
      return NextResponse.json({ ok: false, error: "WhatsApp media URL was missing from the live API." }, { status: 502 });
    }

    mediaResponse = await fetch(downloadUrl, {
      headers: {
        Authorization: `Bearer ${centralToken}`,
        Accept: requestedMimeType || "*/*",
        ...(range ? { Range: range } : {}),
      },
      cache: "no-store",
    });
  }

  if (!mediaResponse.ok || !mediaResponse.body) {
    const details = await mediaResponse.text().catch(() => "");
    return NextResponse.json(
      { ok: false, error: details || "Unable to download the WhatsApp media file." },
      { status: mediaResponse.status || 502 },
    );
  }

  const responseHeaders = new Headers({
    "Cache-Control": "private, max-age=60",
    "Content-Disposition": `inline; filename="${fileName.replace(/"/g, "")}"`,
    "Content-Type": mediaResponse.headers.get("content-type")?.trim() || resolvedMimeType,
  });
  for (const header of ["content-length", "content-range", "accept-ranges", "etag", "last-modified"]) {
    const value = mediaResponse.headers.get(header);
    if (value) responseHeaders.set(header, value);
  }

  return new NextResponse(mediaResponse.body, {
    status: mediaResponse.status === 206 ? 206 : 200,
    headers: responseHeaders,
  });
}
