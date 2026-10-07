import { NextResponse } from "next/server";

import { requireSessionRole } from "@/lib/api/require-session-role";
import {
  auditCallWithAi,
  getCloserIntelligenceSnapshot,
  loadProductFeedback,
  loadVisualProofs,
  saveProductFeedback,
  saveVisualProofs,
  type ProductFeedbackItem,
} from "@/lib/gigxomi/closer-intelligence-store";

export async function GET() {
  const authorization = await requireSessionRole(["SUPER_ADMIN"]);
  if (!authorization.ok) return authorization.response;

  try {
    const snapshot = await getCloserIntelligenceSnapshot();
    return NextResponse.json({ ok: true, snapshot });
  } catch (error) {
    console.error("Failed to load closer intelligence snapshot:", error);
    return NextResponse.json({ ok: false, error: "Failed to load closer intelligence overview." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const authorization = await requireSessionRole(["SUPER_ADMIN"]);
  if (!authorization.ok) return authorization.response;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ ok: false, error: "Invalid action payload." }, { status: 400 });

  const action = String(body.action || "");

  try {
    if (action === "audit-call") {
      const callId = String(body.callId || "");
      if (!callId) return NextResponse.json({ ok: false, error: "callId is required." }, { status: 400 });
      const audit = await auditCallWithAi(callId);
      return NextResponse.json({ ok: true, audit });
    }

    if (action === "update-feedback-status") {
      const feedbackId = String(body.id || "");
      const nextStatus = String(body.status || "");
      const items = await loadProductFeedback();
      const target = items.find((i) => i.id === feedbackId);
      if (target && ["OPEN", "PLANNED", "IN_DEV", "RESOLVED"].includes(nextStatus)) {
        target.status = nextStatus as ProductFeedbackItem["status"];
        target.updatedAt = new Date().toISOString();
        await saveProductFeedback(items);
        return NextResponse.json({ ok: true, item: target });
      }
      return NextResponse.json({ ok: false, error: "Feedback item not found or invalid status." }, { status: 400 });
    }

    if (action === "add-feedback-item") {
      const title = String(body.title || "").trim();
      const description = String(body.description || "").trim();
      const type = String(body.type || "FEATURE_REQUEST");
      const customerQuote = String(body.customerQuote || "").trim();
      if (!title) return NextResponse.json({ ok: false, error: "Title is required." }, { status: 400 });

      const items = await loadProductFeedback();
      const newItem: ProductFeedbackItem = {
        id: `fb-${Date.now()}`,
        type: (["FEATURE_REQUEST", "BUG_REPORT", "UX_FRICTION", "OBJECTION_TREND"].includes(type) ? type : "FEATURE_REQUEST") as ProductFeedbackItem["type"],
        title,
        description,
        source: "manual_admin",
        frequencyCount: 1,
        status: "OPEN",
        severity: (body.severity as ProductFeedbackItem["severity"]) || "MEDIUM",
        customerQuote,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      items.unshift(newItem);
      await saveProductFeedback(items);
      return NextResponse.json({ ok: true, item: newItem });
    }

    if (action === "toggle-proof-status") {
      const proofId = String(body.id || "");
      const proofs = await loadVisualProofs();
      const target = proofs.find((p) => p.id === proofId);
      if (target) {
        target.isActive = !target.isActive;
        await saveVisualProofs(proofs);
        return NextResponse.json({ ok: true, proof: target });
      }
      return NextResponse.json({ ok: false, error: "Visual proof not found." }, { status: 404 });
    }

    return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error) {
    console.error("Closer intelligence action failed:", error);
    return NextResponse.json({ ok: false, error: (error as Error).message || "Action processing failed." }, { status: 500 });
  }
}
