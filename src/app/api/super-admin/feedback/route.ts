import { NextResponse } from "next/server";
import { requireSessionRole } from "@/lib/api/require-session-role";
import { getStoredFeedback, saveStoredFeedback, type CustomerFeedbackItem } from "@/lib/customer-feedback";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await requireSessionRole(["SUPER_ADMIN"]);
    if (!auth.ok) {
      return auth.response;
    }

    const items = await getStoredFeedback();
    
    // Summary statistics
    const total = items.length;
    const pending = items.filter((i) => i.status === "NEW" || i.status === "CONTACTED").length;
    const resolved = items.filter((i) => i.status === "RESOLVED").length;
    const avgRating = total > 0 ? (items.reduce((acc, i) => acc + i.rating, 0) / total).toFixed(1) : "0.0";

    return NextResponse.json({
      success: true,
      items,
      stats: {
        total,
        pending,
        resolved,
        avgRating,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to load feedback" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const auth = await requireSessionRole(["SUPER_ADMIN"]);
    if (!auth.ok) {
      return auth.response;
    }

    const { id, status, adminNotes } = await req.json();
    if (!id || !status) {
      return NextResponse.json({ error: "id and status are required" }, { status: 400 });
    }

    const items = await getStoredFeedback();
    const index = items.findIndex((i) => i.id === id);
    if (index === -1) {
      return NextResponse.json({ error: "Feedback item not found" }, { status: 404 });
    }

    items[index].status = status;
    if (adminNotes !== undefined) {
      items[index].adminNotes = adminNotes;
    }
    if (status === "RESOLVED") {
      items[index].resolvedAt = new Date().toISOString();
    }

    await saveStoredFeedback(items);
    return NextResponse.json({ success: true, item: items[index] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to update feedback" }, { status: 500 });
  }
}
