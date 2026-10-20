import { NextResponse } from "next/server";

import { requireSessionRole } from "@/lib/api/require-session-role";
import { prisma } from "@/lib/prisma";
import { mapCentralConversation } from "@/lib/central-chat-adapter";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const authorization = await requireSessionRole(["SUPER_ADMIN", "ADMIN", "MANAGER", "SALES_AGENT"]);
  if (!authorization.ok) {
    return authorization.response;
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const alias = String(body.alias ?? body.name ?? "").trim();

  if (!alias) {
    return NextResponse.json({ ok: false, error: "Client alias is required." }, { status: 400 });
  }

  const tenantId = authorization.session.role === "SUPER_ADMIN" ? undefined : authorization.session.tenantId?.trim() || undefined;
  const dbConversation = await prisma.appConversation.findFirst({
    where: {
      id,
      ...(tenantId ? { tenantId } : {}),
    },
  });

  if (!dbConversation) {
    return NextResponse.json({ ok: false, error: "Conversation not found." }, { status: 404 });
  }

  await prisma.appConversation.update({
    where: { id },
    data: {
      customerName: alias,
      updatedAt: new Date(),
    },
  });

  await prisma.salesLeadAssignment.updateMany({
    where: { conversationId: id },
    data: {
      customerName: alias,
      updatedAt: new Date(),
    },
  });

  const payload = (dbConversation.payload && typeof dbConversation.payload === "object" && !Array.isArray(dbConversation.payload)
    ? dbConversation.payload
    : {}) as Record<string, unknown>;

  const conversationView = mapCentralConversation(
    {
      id: dbConversation.id,
      customerName: alias,
      customerPhone: dbConversation.customerPhone,
      status: dbConversation.status,
      stage: dbConversation.leadStatusId,
      updatedAt: new Date().toISOString(),
    },
    Array.isArray(payload.messages) ? (payload.messages as never[]) : []
  );

  return NextResponse.json({ ok: true, conversation: conversationView });
}
