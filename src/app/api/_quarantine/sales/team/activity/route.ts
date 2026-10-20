import { NextResponse } from "next/server";
import { requireSessionRole } from "@/lib/api/require-session-role";
import { listAppCloserActivity, closeAppClientSession } from "@/lib/auth/client-sessions";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await requireSessionRole(["SUPER_ADMIN", "ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.response;
  const tenantId = auth.session.tenantId?.trim();
  if (!tenantId) return NextResponse.json({ ok: false, error: "MissingTenantContext" }, { status: 400 });
  return NextResponse.json({ ok: true, generatedAt: new Date().toISOString(), onlineWindowSeconds: 300, users: await listAppCloserActivity(tenantId) });
}

export async function POST(request: Request) {
  const auth = await requireSessionRole(["SUPER_ADMIN", "ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.response;
  const tenantId = auth.session.tenantId?.trim();
  if (!tenantId) return NextResponse.json({ ok: false, error: "MissingTenantContext" }, { status: 400 });
  const body = (await request.json().catch(() => null)) as { userId?: unknown; channel?: unknown } | null;
  const userId = typeof body?.userId === "string" ? body.userId.trim() : "";
  const channel = typeof body?.channel === "string" ? body.channel.trim().toUpperCase() : "";
  if (!userId || !["MOBILE", "DESKTOP"].includes(channel)) return NextResponse.json({ ok: false, error: "ValidationError", message: "userId and channel are required" }, { status: 400 });
  const slot = await prisma.appClientSlot.findFirst({ where: { userId, tenantId, channel: channel as "MOBILE" | "DESKTOP", activeSessionId: { not: null } } });
  if (!slot?.activeSessionId) return NextResponse.json({ ok: false, error: "SessionNotFound" }, { status: 404 });
  const session = await prisma.appClientSession.findUnique({ where: { id: slot.activeSessionId }, select: { sessionId: true } });
  if (!session) return NextResponse.json({ ok: false, error: "SessionNotFound" }, { status: 404 });
  await closeAppClientSession(session.sessionId, "REVOKED", `Revoked by ${auth.session.displayName ?? "workspace administrator"}`);
  return NextResponse.json({ ok: true, revoked: true, userId, channel });
}
