import { NextResponse } from "next/server";
import { requireSessionRole } from "@/lib/api/require-session-role";
import { addCorrection, generateAiPlaygroundResponse } from "@/lib/gigxomi/ai-beta-store";

export async function POST(request: Request) {
  const auth = await requireSessionRole(["SALES_AGENT", "ADMIN", "SUPER_ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();

    // Check if submitting a human correction
    if (body.action === "correct") {
      const correction = await addCorrection({
        userQuery: String(body.userQuery || ""),
        botAnswer: String(body.botAnswer || ""),
        correction: String(body.correction || ""),
      });
      return NextResponse.json({ ok: true, correction });
    }

    // Interactive message query
    const message = String(body.message || "").trim();
    if (!message) return NextResponse.json({ ok: false, error: "Enter a message." }, { status: 400 });

    const reply = await generateAiPlaygroundResponse(message);
    return NextResponse.json({ ok: true, reply });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Chat failed" },
      { status: 500 }
    );
  }
}
