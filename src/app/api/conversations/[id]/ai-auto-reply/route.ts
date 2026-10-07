import { NextResponse } from "next/server";

import { getConversationViewForSession } from "@/lib/api/conversation-view-response";
import { requireSessionRole } from "@/lib/api/require-session-role";
import { updateConversationAiAutoReplyFromFile } from "@/lib/gigxomi/dummy-platform-file-store";
import { getGlobalAiAutoReplySettings } from "@/lib/gigxomi/ai-automation-settings";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const authorization = await requireSessionRole(["SUPER_ADMIN", "ADMIN", "MANAGER", "SALES_AGENT"]);
  if (!authorization.ok) {
    return authorization.response;
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const disabled = Boolean(body?.disabled);

  if (!disabled) {
    const globalSettings = await getGlobalAiAutoReplySettings();
    if (!globalSettings.enabled) {
      return NextResponse.json(
        { ok: false, error: "Global AI is paused. An admin or manager must resume AI for all chats first." },
        { status: 409 },
      );
    }
  }

  const existing = await getConversationViewForSession(authorization.session, id);
  if (!existing) {
    return NextResponse.json({ ok: false, error: "Conversation not found." }, { status: 404 });
  }

  const roleForUpdate =
    authorization.session.role === "SALES_AGENT"
      ? "closer"
      : (authorization.session.role.toLowerCase() as "admin" | "manager");

  const conversation = await updateConversationAiAutoReplyFromFile(
    id,
    disabled,
    roleForUpdate,
    authorization.session.displayName || "Closer",
  );
  if (!conversation) {
    return NextResponse.json({ ok: false, error: "Unable to update AI auto-reply mode." }, { status: 409 });
  }

  const conversationView = await getConversationViewForSession(authorization.session, id);

  return NextResponse.json({
    ok: true,
    disabled,
    conversation: conversationView,
  });
}
