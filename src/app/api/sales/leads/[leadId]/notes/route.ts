import { NextResponse } from "next/server";
import { requireSessionRole } from "@/lib/api/require-session-role";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request, { params }: { params: Promise<{ leadId: string }> }) {
  const auth = await requireSessionRole(["SALES_AGENT", "ADMIN", "SUPER_ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.response;

  try {
    const { leadId } = await params;
    const notes = await prisma.salesLeadTimelineEntry.findMany({
      where: { leadId, type: { in: ["NOTE", "VOICE_NOTE", "CALL_NOTE", "MANUAL_NOTE"] } },
      orderBy: { createdAt: "desc" },
    });

    const lead = await prisma.salesLeadAssignment.findUnique({
      where: { id: leadId },
      select: { notes: true, customerName: true },
    });

    return NextResponse.json({
      ok: true,
      leadNotes: lead?.notes || "",
      timelineNotes: notes,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to fetch lead notes" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ leadId: string }> }) {
  const auth = await requireSessionRole(["SALES_AGENT", "ADMIN", "SUPER_ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.response;

  try {
    const { leadId } = await params;
    const body = await request.json();
    const content = String(body.body || body.note || "").trim();
    if (!content) return NextResponse.json({ ok: false, error: "Note content cannot be empty" }, { status: 400 });

    const lead = await prisma.salesLeadAssignment.findUnique({ where: { id: leadId } });
    if (!lead) return NextResponse.json({ ok: false, error: "Lead not found" }, { status: 404 });

    // 1. Create timeline entry
    const entry = await prisma.salesLeadTimelineEntry.create({
      data: {
        leadId,
        userId: auth.session.userId,
        agentId: lead.assignedAgentId,
        type: String(body.type || "NOTE"),
        body: content,
        metadata: {
          authorName: auth.session.displayName || "Sales User",
          source: body.source || "dashboard",
        },
      },
    });

    // 2. Also update lead summary notes
    await prisma.salesLeadAssignment.update({
      where: { id: leadId },
      data: {
        notes: content,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ ok: true, note: entry });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to save note" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ leadId: string }> }) {
  const auth = await requireSessionRole(["SALES_AGENT", "ADMIN", "SUPER_ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.response;

  try {
    const { leadId } = await params;
    const body = await request.json();
    const noteId = String(body.noteId || "");
    const content = String(body.body || body.note || "").trim();
    if (!content) return NextResponse.json({ ok: false, error: "Note content cannot be empty" }, { status: 400 });

    if (noteId) {
      const updated = await prisma.salesLeadTimelineEntry.update({
        where: { id: noteId },
        data: {
          body: content,
          metadata: {
            updatedAt: new Date().toISOString(),
            updatedBy: auth.session.displayName,
          },
        },
      });
      return NextResponse.json({ ok: true, note: updated });
    } else {
      // Update the lead's main notes field
      await prisma.salesLeadAssignment.update({
        where: { id: leadId },
        data: { notes: content },
      });
      return NextResponse.json({ ok: true, notes: content });
    }
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to update note" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ leadId: string }> }) {
  const auth = await requireSessionRole(["SALES_AGENT", "ADMIN", "SUPER_ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.response;

  try {
    const { leadId } = await params;
    const { searchParams } = new URL(request.url);
    const noteId = searchParams.get("noteId");

    if (noteId) {
      await prisma.salesLeadTimelineEntry.delete({ where: { id: noteId } });
    } else {
      // Clear main notes field
      await prisma.salesLeadAssignment.update({
        where: { id: leadId },
        data: { notes: null },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to delete note" },
      { status: 500 }
    );
  }
}
