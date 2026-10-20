import { NextResponse } from "next/server";
import { requireSessionRole } from "@/lib/api/require-session-role";
import { listNotificationsForActor } from "@/lib/gigxomi/app-notification-service";

export async function GET() {
  let auth;
  try {
    auth = await requireSessionRole(["SUPER_ADMIN", "ADMIN", "MANAGER", "FREELANCER", "SALES_AGENT"]);
  } catch (error) {
    // The refactor branch is central-API first and intentionally has no local
    // DATABASE_URL. Keep the shell's notification control stable until the
    // central notifications contract is available instead of surfacing a 500.
    if (error instanceof Error && error.message.includes("DATABASE_URL is not configured")) {
      return NextResponse.json({ ok: true, unread: 0, notifications: [] });
    }
    throw error;
  }
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const result = await listNotificationsForActor(auth.session);
    const notifications = result.notifications.map((n) => ({
      id: n.id,
      title: n.title,
      body: n.message,
      message: n.message,
      status: n.status,
      entityType: n.entityType,
      entityId: n.entityId,
      createdAt: n.createdAt.toISOString(),
      readAt: n.readAt?.toISOString() ?? null,
    }));

    return NextResponse.json({
      ok: true,
      unread: result.unread,
      notifications,
    });
  } catch (error) {
    console.error("notifications:list failed", error);
    return NextResponse.json({
      ok: false,
      unread: 0,
      notifications: [],
    });
  }
}
