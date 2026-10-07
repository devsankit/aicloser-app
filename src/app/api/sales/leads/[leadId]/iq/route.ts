import { NextResponse } from "next/server";
import { requireSessionRole } from "@/lib/api/require-session-role";
import { prisma } from "@/lib/prisma";
import { generateLeadIqProfile } from "@/lib/gigxomi/lead-iq-store";

export async function GET(_request: Request, context: { params: Promise<{ leadId: string }> }) {
  const auth = await requireSessionRole(["SALES_AGENT", "ADMIN", "SUPER_ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.response;

  try {
    const { leadId } = await context.params;
    const lead = await prisma.salesLeadAssignment.findUnique({
      where: { id: leadId },
    });
    if (!lead) {
      return NextResponse.json({ ok: false, error: "Lead not found" }, { status: 404 });
    }

    const profile = await generateLeadIqProfile(lead);
    return NextResponse.json({ ok: true, profile });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Failed to generate Lead-IQ" }, { status: 500 });
  }
}
