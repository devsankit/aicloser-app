import { NextResponse } from "next/server";

import { requireSessionRole } from "@/lib/api/require-session-role";
import { crmStatuses } from "@/lib/gigxomi/crm-data";
import { prisma } from "@/lib/prisma";
import { getCentralConversations, mapCentralConversation } from "@/lib/central-chat-adapter";

export async function GET(request: Request) {
  // 1. Primary: Central Dedicated API Engine
  try {
    const centralResult = await getCentralConversations(new URL(request.url).searchParams);
    if (centralResult && Array.isArray(centralResult.conversations) && centralResult.conversations.length > 0) {
      return NextResponse.json(centralResult);
    }
  } catch {
    // Proceed to Direct Live PostgreSQL Query
  }

  // 2. Direct Live PostgreSQL Query Fallback
  const authorization = await requireSessionRole(["SUPER_ADMIN", "ADMIN", "MANAGER", "SALES_AGENT"]);
  if (!authorization.ok) {
    return authorization.response;
  }

  const { searchParams } = new URL(request.url);
  const explicitTenantId = searchParams.get("tenantId")?.trim() || undefined;
  const tenantId =
    authorization.session.role === "SUPER_ADMIN"
      ? explicitTenantId
      : authorization.session.tenantId?.trim() || explicitTenantId;

  const limitParam = Number(searchParams.get("limit") ?? "");
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(Math.floor(limitParam), 200) : 50;

  const dbConversations = await prisma.appConversation.findMany({
    where: {
      ...(tenantId ? { tenantId } : {}),
      ...(searchParams.get("status") ? { status: searchParams.get("status")! } : {}),
      ...(searchParams.get("search")
        ? {
            OR: [
              { customerName: { contains: searchParams.get("search")!, mode: "insensitive" } },
              { customerPhone: { contains: searchParams.get("search")! } },
            ],
          }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });

  const conversationIds = dbConversations.map((c) => c.id);
  const leads = conversationIds.length
    ? await prisma.salesLeadAssignment.findMany({
        where: {
          conversationId: { in: conversationIds },
          ...(tenantId ? { tenantId } : {}),
        },
        select: {
          conversationId: true,
          id: true,
          stage: true,
          notes: true,
        },
      })
    : [];

  const leadsByConvId = new Map(leads.map((l) => [l.conversationId, l]));

  const conversations = dbConversations.map((dbConv) => {
    const payload = (dbConv.payload && typeof dbConv.payload === "object" && !Array.isArray(dbConv.payload)
      ? dbConv.payload
      : {}) as Record<string, unknown>;
    const messages = Array.isArray(payload.messages) ? (payload.messages as never[]) : [];
    const lead = leadsByConvId.get(dbConv.id) as { id: string; stage: string; notes?: string | null } | undefined;
    return mapCentralConversation(
      {
        id: dbConv.id,
        customerName: dbConv.customerName,
        customerPhone: dbConv.customerPhone,
        status: dbConv.status,
        stage: lead?.stage || dbConv.leadStatusId,
        leadStage: lead?.stage,
        leadId: lead?.id,
        updatedAt: dbConv.updatedAt.toISOString(),
      },
      messages
    );
  });

  return NextResponse.json({
    ok: true,
    conversations,
    total: conversations.length,
    supportDataIncluded: false,
    assignableEditors: [],
    leadStatuses: crmStatuses.map((status) => ({
      id: status.id,
      label: status.label,
      tone: status.tone,
      order: status.order,
      active: status.active,
    })),
    templates: [],
  });
}

export async function POST(request: Request) {
  const authorization = await requireSessionRole(["SUPER_ADMIN", "ADMIN", "MANAGER"]);
  if (!authorization.ok) {
    return authorization.response;
  }

  await request.json().catch(() => null);

  return NextResponse.json(
    {
      ok: false,
      error: "Direct customer conversation creation has been retired. Use WhatsApp webhook intake or manual lead registration.",
    },
    { status: 410 },
  );
}

export async function DELETE(request: Request) {
  const authorization = await requireSessionRole(["SUPER_ADMIN", "ADMIN", "MANAGER", "SALES_AGENT"]);
  if (!authorization.ok) {
    return authorization.response;
  }

  const { searchParams } = new URL(request.url);
  const conversationId = searchParams.get("conversationId")?.trim() || searchParams.get("id")?.trim();
  if (!conversationId) {
    return NextResponse.json({ ok: false, error: "Missing conversationId" }, { status: 400 });
  }

  try {
    await prisma.$transaction([
      prisma.salesLeadAssignment.deleteMany({
        where: {
          OR: [{ conversationId }, { id: `sales-conversation-${conversationId}` }],
        },
      }),
      prisma.appChatMessageReceipt.deleteMany({
        where: { conversationId },
      }),
      prisma.appChatTypingPresence.deleteMany({
        where: { conversationId },
      }),
      prisma.appConversation.deleteMany({
        where: { id: conversationId },
      }),
    ]);
  } catch (error) {
    console.error("[api/conversations] DELETE error in database:", error);
    return NextResponse.json({ ok: false, error: "Failed to delete conversation from database" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, deletedConversationId: conversationId });
}
