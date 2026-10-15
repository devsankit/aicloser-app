import { NextResponse } from "next/server";

import { requireSessionRole } from "@/lib/api/require-session-role";
import { resolveSessionTenantId } from "@/lib/api/resolve-session-tenant";
import {
  DEFAULT_SHOW_ONLY_ASSIGNED_CHATS,
  saveShowOnlyAssignedChats,
  showOnlyAssignedChatsForTenant,
} from "@/lib/api/sales-chat-visibility";

export async function GET(request: Request) {
  const auth = await requireSessionRole(["SUPER_ADMIN", "ADMIN", "MANAGER", "SALES_AGENT"]);
  if (!auth.ok) return auth.response;

  const requestedTenantId = new URL(request.url).searchParams.get("tenantId");
  const tenantId = auth.session.role === "SUPER_ADMIN"
    ? requestedTenantId?.trim() || "tenant-gigxomi"
    : resolveSessionTenantId(auth.session, requestedTenantId);
  const showOnlyAssignedChats = await showOnlyAssignedChatsForTenant(tenantId);
  return NextResponse.json({
    ok: true,
    tenantId,
    showOnlyAssignedChats: showOnlyAssignedChats ?? DEFAULT_SHOW_ONLY_ASSIGNED_CHATS,
    canEdit: auth.session.role === "SUPER_ADMIN" || auth.session.role === "ADMIN",
  });
}

export async function POST(request: Request) {
  const auth = await requireSessionRole(["SUPER_ADMIN", "ADMIN"]);
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as { tenantId?: string; showOnlyAssignedChats?: unknown } | null;
  if (typeof body?.showOnlyAssignedChats !== "boolean") {
    return NextResponse.json({ ok: false, error: "Choose whether sales users should see assigned chats only." }, { status: 400 });
  }

  const tenantId = auth.session.role === "SUPER_ADMIN"
    ? body.tenantId?.trim() || "tenant-gigxomi"
    : resolveSessionTenantId(auth.session, body.tenantId);
  const settings = await saveShowOnlyAssignedChats(tenantId, body.showOnlyAssignedChats);
  return NextResponse.json({
    ok: true,
    tenantId,
    showOnlyAssignedChats: settings.showOnlyAssignedChats,
    message: settings.showOnlyAssignedChats
      ? "Sales users will now see only chats assigned to them."
      : "Sales users can now see all chats in this workspace.",
  });
}
