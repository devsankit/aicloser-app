import { NextResponse } from "next/server";

import { requireSessionRole } from "@/lib/api/require-session-role";
import { prisma } from "@/lib/prisma";
import { mapCentralConversation } from "@/lib/central-chat-adapter";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const authorization = await requireSessionRole(["SUPER_ADMIN", "ADMIN", "MANAGER", "SALES_AGENT"]);
  if (!authorization.ok) {
    return authorization.response;
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const action = String(body?.action ?? "").trim().toUpperCase();

  if (action !== "ACCEPT" && action !== "PASS") {
    return NextResponse.json({ ok: false, error: "Unsupported action. Use ACCEPT or PASS." }, { status: 400 });
  }

  const tenantId = authorization.session.role === "SUPER_ADMIN" ? undefined : authorization.session.tenantId?.trim() || undefined;
  const conversation = await prisma.appConversation.findFirst({
    where: {
      id,
      ...(tenantId ? { tenantId } : {}),
    },
  });

  if (!conversation) {
    return NextResponse.json({ ok: false, error: "Conversation not found." }, { status: 404 });
  }

  if (action === "ACCEPT") {
    const agentProfile = await prisma.salesAgentProfile.findFirst({
      where: { userId: authorization.session.userId },
    });

    const assignedId = agentProfile?.id || authorization.session.userId;
    const assignedName = authorization.session.displayName || "Assigned Closer";

    await prisma.appConversation.update({
      where: { id },
      data: {
        assignedFreelancerId: assignedId,
        assignedFreelancerName: assignedName,
        updatedAt: new Date(),
      },
    });

    if (agentProfile) {
      await prisma.salesLeadAssignment.updateMany({
        where: { conversationId: id },
        data: {
          assignedAgentId: agentProfile.id,
          updatedAt: new Date(),
        },
      });
    }
  }

  const payload = (conversation.payload && typeof conversation.payload === "object" && !Array.isArray(conversation.payload)
    ? conversation.payload
    : {}) as Record<string, unknown>;

  const conversationView = mapCentralConversation(
    {
      id: conversation.id,
      customerName: conversation.customerName,
      customerPhone: conversation.customerPhone,
      status: conversation.status,
      stage: conversation.leadStatusId,
      updatedAt: new Date().toISOString(),
    },
    Array.isArray(payload.messages) ? (payload.messages as never[]) : []
  );

  return NextResponse.json({
    ok: true,
    action,
    conversation: conversationView,
  });
}
