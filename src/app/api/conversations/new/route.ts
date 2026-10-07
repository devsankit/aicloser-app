import { NextResponse } from "next/server";

import { getConversationViewForSession } from "@/lib/api/conversation-view-response";
import { requireSessionRole } from "@/lib/api/require-session-role";
import { createManualConversationFromFile } from "@/lib/gigxomi/dummy-platform-file-store";

export async function POST(request: Request) {
  const authorization = await requireSessionRole(["SUPER_ADMIN", "ADMIN", "MANAGER"]);
  if (!authorization.ok) {
    return authorization.response;
  }

  const body = await request.json();
  const result = await createManualConversationFromFile({
    role: authorization.session.role === "ADMIN" || authorization.session.role === "SUPER_ADMIN" ? "admin" : "manager",
    customerName: body.customerName ?? "",
    customerPhone: body.customerPhone ?? "",
    serviceId: body.serviceId ?? undefined,
    templateId: body.templateId ?? undefined,
  });

  const conversationView = await getConversationViewForSession(authorization.session, result.conversation.id);

  return NextResponse.json({
    ok: true,
    ...result,
    conversation: conversationView,
  });
}
