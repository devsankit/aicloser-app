import { NextResponse } from "next/server";

import { requireSessionRole } from "@/lib/api/require-session-role";
import { prisma } from "@/lib/prisma";
import { centralApiRequest } from "@/lib/central-api-server";
import { mapCentralConversation } from "@/lib/central-chat-adapter";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const authorization = await requireSessionRole(["SUPER_ADMIN", "ADMIN", "MANAGER", "SALES_AGENT"]);
  if (!authorization.ok) {
    return authorization.response;
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));

  // 1. Central Dedicated API Engine
  try {
    const payload = await centralApiRequest(`/conversations/${encodeURIComponent(id)}/assignment`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    return NextResponse.json({ ok: true, ...(payload as Record<string, unknown>) });
  } catch {
    // Proceed to Direct Live PostgreSQL Operations
  }

  // 2. Direct Live Database Operations
  const tenantId = authorization.session.role === "SUPER_ADMIN" ? undefined : authorization.session.tenantId?.trim() || undefined;
  const conversation = await prisma.appConversation.findFirst({
    where: {
      id,
      ...(tenantId ? { tenantId } : {}),
    },
  });

  if (!conversation) {
    return NextResponse.json({ ok: false, error: "Conversation not found" }, { status: 404 });
  }

  const targetAgentUserId = String(body.agentId || body.userId || body.freelancerId || (Array.isArray(body.freelancerIds) ? body.freelancerIds[0] : "")).trim();
  if (!targetAgentUserId) {
    return NextResponse.json({ ok: false, error: "Please select an agent to assign." }, { status: 400 });
  }

  const agentProfile = await prisma.salesAgentProfile.findFirst({
    where: {
      OR: [{ id: targetAgentUserId }, { userId: targetAgentUserId }],
    },
    include: { user: true },
  });

  const assignedFreelancerId = agentProfile?.id || targetAgentUserId;
  const assignedFreelancerName = agentProfile?.user?.displayName || "Assigned Closer";

  await prisma.appConversation.update({
    where: { id },
    data: {
      assignedFreelancerId,
      assignedFreelancerName,
      updatedAt: new Date(),
    },
  });

  const phoneDigits = String(conversation.customerPhone ?? "").replace(/\D/g, "");
  if (agentProfile) {
    await prisma.salesLeadAssignment.updateMany({
      where: {
        OR: [
          { conversationId: id },
          ...(phoneDigits.length >= 10 ? [{ customerPhone: { endsWith: phoneDigits.slice(-10) } }] : []),
        ],
      },
      data: {
        assignedAgentId: agentProfile.id,
        conversationId: id,
        updatedAt: new Date(),
      },
    });
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
    conversation: {
      ...conversationView,
      assignedFreelancerId,
      assignedFreelancerName,
    },
  });
}
