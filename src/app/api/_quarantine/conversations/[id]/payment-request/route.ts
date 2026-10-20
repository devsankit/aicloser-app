import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";

import { requireSessionRole } from "@/lib/api/require-session-role";
import { prisma } from "@/lib/prisma";
import { mapCentralConversation } from "@/lib/central-chat-adapter";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const authorization = await requireSessionRole(["SUPER_ADMIN", "ADMIN", "MANAGER", "SALES_AGENT"]);
  if (!authorization.ok) {
    return authorization.response;
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
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

  const existingRequests = Array.isArray(currentPayload.paymentRequests)
    ? (currentPayload.paymentRequests as Record<string, unknown>[])
    : [];

  if (body.action === "mark-status") {
    const paymentRequestId = String(body.paymentRequestId ?? "");
    const updatedStatus = String(body.status ?? "Paid");

    const updatedRequests = existingRequests.map((req) =>
      req.id === paymentRequestId ? { ...req, status: updatedStatus, updatedAt: new Date().toISOString() } : req
    );

    await prisma.appConversation.update({
      where: { id },
      data: {
        payload: {
          ...currentPayload,
          paymentRequests: updatedRequests,
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
        paymentRequests: updatedRequests,
      },
    });
  }

  // Create new payment request in chat
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ ok: false, error: "Enter a valid amount." }, { status: 400 });
  }

  const newPaymentRequest = {
    id: `payreq-${Date.now()}-${randomBytes(4).toString("hex")}`,
    title: String(body.title ?? "Payment Request").trim(),
    amount,
    currency: "INR",
    status: "Pending",
    createdByUserId: authorization.session.userId,
    createdByRole: authorization.session.role,
    createdAt: new Date().toISOString(),
    attachments: Array.isArray(body.attachments) ? body.attachments : [],
  };

  const updatedRequests = [...existingRequests, newPaymentRequest];

  await prisma.appConversation.update({
    where: { id },
    data: {
      payload: {
        ...currentPayload,
        paymentRequests: updatedRequests,
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
    paymentRequest: newPaymentRequest,
    conversation: {
      ...conversationView,
      paymentRequests: updatedRequests,
    },
  });
}
