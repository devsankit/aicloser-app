import { NextResponse } from "next/server";

import { requireSessionRole } from "@/lib/api/require-session-role";
import { prisma } from "@/lib/prisma";
import { mapCentralConversation } from "@/lib/central-chat-adapter";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const authorization = await requireSessionRole(["SUPER_ADMIN", "ADMIN", "MANAGER"]);
  if (!authorization.ok) {
    return authorization.response;
  }

  const { id } = await context.params;
  const tenantId = authorization.session.role === "SUPER_ADMIN" ? undefined : authorization.session.tenantId?.trim() || undefined;

  const dbConversation = await prisma.appConversation.findFirst({
    where: {
      id,
      ...(tenantId ? { tenantId } : {}),
    },
  });

  if (!dbConversation) {
    return NextResponse.json({ ok: false, error: "Conversation not found" }, { status: 404 });
  }

  const currentPayload =
    dbConversation.payload && typeof dbConversation.payload === "object" && !Array.isArray(dbConversation.payload)
      ? (dbConversation.payload as Record<string, unknown>)
      : {};

  const currentIntake = (currentPayload.projectIntake as Record<string, unknown>) || {};
  const updatedIntake = {
    ...currentIntake,
    status: "approved",
    approvedAt: new Date().toISOString(),
    approvedByUserId: authorization.session.userId,
    approvedByName: authorization.session.displayName || "Admin",
  };

  await prisma.appConversation.update({
    where: { id },
    data: {
      payload: {
        ...currentPayload,
        projectIntake: updatedIntake,
        updatedAt: new Date().toISOString(),
      } as any,
      updatedAt: new Date(),
    },
  });

  const conversationView = mapCentralConversation(
    {
      id: dbConversation.id,
      customerName: dbConversation.customerName,
      customerPhone: dbConversation.customerPhone,
      status: dbConversation.status,
      stage: dbConversation.leadStatusId,
      updatedAt: new Date().toISOString(),
    },
    Array.isArray(currentPayload.messages) ? (currentPayload.messages as never[]) : []
  );

  return NextResponse.json({
    ok: true,
    conversation: {
      ...conversationView,
      projectIntake: updatedIntake,
    },
  });
}
