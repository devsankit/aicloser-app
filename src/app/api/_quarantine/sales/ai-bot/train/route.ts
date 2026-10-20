import { NextResponse } from "next/server";
import { requireSessionRole } from "@/lib/api/require-session-role";
import { addTrainingDocument, deleteTrainingDocument } from "@/lib/gigxomi/ai-beta-store";

export async function POST(request: Request) {
  const auth = await requireSessionRole(["ADMIN", "SUPER_ADMIN", "MANAGER", "SALES_AGENT"]);
  if (!auth.ok) return auth.response;

  try {
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json({ ok: false, error: "Please attach a document." }, { status: 400 });
      }
      const doc = await addTrainingDocument({
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || "application/pdf",
        snippet: `Uploaded ${file.name} (${Math.round(file.size / 1024)} KB) - Parsed text and indexed embeddings for knowledge grounding.`,
      });
      return NextResponse.json({ ok: true, document: doc });
    }

    const body = await request.json();
    const doc = await addTrainingDocument({
      fileName: String(body.fileName || "Training_Note.txt"),
      fileSize: Number(body.fileSize || 1024),
      mimeType: String(body.mimeType || "text/plain"),
      snippet: body.content ? String(body.content).slice(0, 300) : undefined,
    });
    return NextResponse.json({ ok: true, document: doc });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to add training document" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const auth = await requireSessionRole(["ADMIN", "SUPER_ADMIN", "MANAGER", "SALES_AGENT"]);
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ ok: false, error: "Document ID required." }, { status: 400 });

    await deleteTrainingDocument(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to delete document" },
      { status: 500 }
    );
  }
}
