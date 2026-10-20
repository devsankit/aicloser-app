import { NextResponse } from "next/server";
import path from "node:path";
import { requireSessionRole } from "@/lib/api/require-session-role";
import { readSalesMobileRecording } from "@/lib/gigxomi/sales-mobile-store";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSessionRole(["SALES_AGENT", "ADMIN", "SUPER_ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.response;
  try {
    const { id } = await params;
    const recording = await readSalesMobileRecording({ userId: auth.session.userId, role: auth.session.role as any }, id);
    const size = recording.bytes.byteLength;
    // Some older uploads were stored with a generic MIME type even though the
    // bytes are an Android MPEG-4/AAC recording. Keep the browser and mobile
    // players on a decodable media type instead of returning octet-stream.
    const extension = path.extname(recording.call.recordingPath || "").toLowerCase();
    const extensionMimeType: Record<string, string> = {
      ".m4a": "audio/mp4",
      ".mp4": "audio/mp4",
      ".aac": "audio/aac",
      ".wav": "audio/wav",
      ".mp3": "audio/mpeg",
      ".3gp": "audio/3gpp",
    };
    const storedMimeType = recording.call.recordingMimeType?.trim().toLowerCase();
    const contentType = storedMimeType && storedMimeType !== "application/octet-stream"
      ? storedMimeType
      : extensionMimeType[extension] || "audio/mp4";
    const range = request.headers.get("range");
    const headers = {
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, no-store",
      "Content-Type": contentType,
      "Content-Disposition": "inline",
    };

    if (!range) {
      return new NextResponse(recording.bytes, { headers: { ...headers, "Content-Length": String(size) } });
    }

    const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (!match) {
      return new NextResponse(null, { status: 416, headers: { ...headers, "Content-Range": `bytes */${size}` } });
    }

    const requestedStart = match[1] ? Number(match[1]) : 0;
    const requestedEnd = match[2] ? Number(match[2]) : size - 1;
    const start = Math.max(0, requestedStart);
    const end = Math.min(size - 1, requestedEnd);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= size) {
      return new NextResponse(null, { status: 416, headers: { ...headers, "Content-Range": `bytes */${size}` } });
    }

    const chunk = recording.bytes.subarray(start, end + 1);
    return new NextResponse(chunk, {
      status: 206,
      headers: {
        ...headers,
        "Content-Length": String(chunk.byteLength),
        "Content-Range": `bytes ${start}-${end}/${size}`,
      },
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Recording not found." }, { status: 404 });
  }
}
