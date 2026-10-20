import { NextResponse } from "next/server";

import { requireSessionRole } from "@/lib/api/require-session-role";
import { centralApiRequest } from "@/lib/central-api-server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const isTyping = Boolean(body?.active ?? body?.isTyping);

  // 1. Central Dedicated API Engine
  try {
    const payload = await centralApiRequest(`/conversations/${encodeURIComponent(id)}/typing`, {
      method: "POST",
      body: JSON.stringify({ lane: body?.lane === "internal" ? "internal" : "customer", isTyping }),
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

  try {
    if (isTyping) {
      await prisma.appChatTypingPresence.upsert({
        where: {
          conversationId_userId: {
            conversationId: id,
            userId: authorization.session.userId,
          },
        },
        create: {
          conversationId: id,
          userId: authorization.session.userId,
          userName: authorization.session.displayName || "Sales closer",
          updatedAt: new Date(),
        },
        update: {
          updatedAt: new Date(),
        },
      });
    } else {
      await prisma.appChatTypingPresence.deleteMany({
        where: {
          conversationId: id,
          userId: authorization.session.userId,
        },
      });
    }
  } catch {
    // Non-critical typing presence state
  }

  return NextResponse.json({ ok: true, active: isTyping });
}
