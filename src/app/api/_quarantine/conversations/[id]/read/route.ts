import { NextResponse } from "next/server";

import { requireSessionRole } from "@/lib/api/require-session-role";
import { centralApiRequest } from "@/lib/central-api-server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));

  // 1. Central Dedicated API Engine
  try {
    const payload = await centralApiRequest(`/conversations/${encodeURIComponent(id)}/read`, {
      method: "POST",
      body: JSON.stringify({ lane: body?.lane === "internal" ? "internal" : "customer" }),
    });
    return NextResponse.json({ ok: true, ...(payload as Record<string, unknown>) });
  } catch {
    // Proceed to Direct Live Database Fallback
  }

  // 2. Direct Live PostgreSQL Operations
  const authorization = await requireSessionRole(["SUPER_ADMIN", "ADMIN", "MANAGER", "SALES_AGENT"]);
  if (!authorization.ok) {
    return authorization.response;
  }

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

  const payload = (conversation.payload && typeof conversation.payload === "object" && !Array.isArray(conversation.payload)
    ? conversation.payload
    : {}) as Record<string, unknown>;

  const readState = (payload.readStateByAudience as Record<string, string>) || {};
  readState.sales = new Date().toISOString();

  await prisma.appConversation.update({
    where: { id },
    data: {
      payload: {
        ...payload,
        readStateByAudience: readState,
        updatedAt: new Date().toISOString(),
      } as any,
      updatedAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true, message: "Conversation marked as read" });
}
