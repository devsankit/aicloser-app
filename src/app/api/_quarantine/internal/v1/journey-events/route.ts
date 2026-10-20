import { NextResponse } from "next/server";

import { validateJourneyEnvelope } from "@/lib/gxclosers/journey-contract";
import { ingestJourneyEvent } from "@/lib/gxclosers/journey-ingestion";
import { verifyGigxomiJourneySignature } from "@/lib/gxclosers/journey-signature";

const MAX_BODY_BYTES = 256 * 1024;

export async function POST(request: Request) {
  const body = await request.text();
  if (Buffer.byteLength(body, "utf8") > MAX_BODY_BYTES) {
    return NextResponse.json({ ok: false, error: "Payload is too large." }, { status: 413 });
  }
  if (!verifyGigxomiJourneySignature({
    body,
    signature: request.headers.get("x-gigxomi-signature"),
    timestamp: request.headers.get("x-gigxomi-timestamp"),
  })) {
    return NextResponse.json({ ok: false, error: "Invalid signature." }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(body || "null") as unknown;
  } catch {
    return NextResponse.json({ ok: false, error: "Payload must be valid JSON." }, { status: 400 });
  }
  const validation = validateJourneyEnvelope(payload);
  if (!validation.ok) return NextResponse.json({ ok: false, error: validation.error }, { status: 400 });

  try {
    const result = await ingestJourneyEvent(validation.event);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[gxclosers] Journey ingestion failed", error);
    return NextResponse.json({ ok: false, error: "Journey event could not be ingested." }, { status: 500 });
  }
}
