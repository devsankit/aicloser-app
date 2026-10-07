import "server-only";

import { AppClientChannel, AppClientSessionStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const CLIENT_ACTIVITY_WINDOW_MS = 5 * 60 * 1000;
export const CLIENT_HEARTBEAT_WRITE_INTERVAL_MS = 30 * 1000;

export class ClientSlotOccupiedError extends Error {
  readonly code = "ClientSlotOccupied";
  constructor(readonly channel: AppClientChannel, readonly lastActiveAt: Date | null, readonly deviceName: string | null) {
    super(`An active ${channel.toLowerCase()} session already exists for this user`);
    this.name = "ClientSlotOccupiedError";
  }
}

type ClientSessionInput = {
  userId: string;
  tenantId: string | null;
  channel: AppClientChannel;
  installationId: string;
  deviceId?: string | null;
  deviceName?: string | null;
  platform?: string | null;
  appVersion?: string | null;
};

async function withClientSlotLock<T>(input: Pick<ClientSessionInput, "userId" | "channel">, fn: (tx: Prisma.TransactionClient) => Promise<T>) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`aicloser:client-slot:${input.userId}:${input.channel}`}))`;
    return fn(tx);
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function acquireAppClientSession(input: ClientSessionInput) {
  return withClientSlotLock(input, async (tx) => {
    let slot = await tx.appClientSlot.findUnique({ where: { userId_channel: { userId: input.userId, channel: input.channel } } });
    const active = slot?.activeSessionId ? await tx.appClientSession.findUnique({ where: { id: slot.activeSessionId } }) : null;

    if (active?.status === AppClientSessionStatus.ACTIVE) {
      if (active.installationId !== input.installationId) {
        throw new ClientSlotOccupiedError(input.channel, active.lastActiveAt, active.deviceName);
      }
      const now = new Date();
      const session = await tx.appClientSession.update({ where: { id: active.id }, data: { lastActiveAt: now, deviceId: input.deviceId ?? active.deviceId, deviceName: input.deviceName ?? active.deviceName, platform: input.platform ?? active.platform, appVersion: input.appVersion ?? active.appVersion } });
      await tx.appClientSlot.update({ where: { id: slot!.id }, data: { status: "ACTIVE", lastActiveAt: now, deviceId: input.deviceId ?? slot!.deviceId, deviceName: input.deviceName ?? slot!.deviceName, platform: input.platform ?? slot!.platform, appVersion: input.appVersion ?? slot!.appVersion } });
      return { session, resumed: true };
    }

    if (!slot) {
      slot = await tx.appClientSlot.create({ data: { userId: input.userId, tenantId: input.tenantId, channel: input.channel, status: "AVAILABLE" } });
    }
    const now = new Date();
    const session = await tx.appClientSession.create({
      data: { sessionId: crypto.randomUUID(), userId: input.userId, tenantId: input.tenantId, slotId: slot.id, channel: input.channel, installationId: input.installationId, deviceId: input.deviceId ?? null, deviceName: input.deviceName ?? null, platform: input.platform ?? null, appVersion: input.appVersion ?? null, status: "ACTIVE", loginAt: now, lastActiveAt: now },
    });
    await tx.appClientSlot.update({ where: { id: slot.id }, data: { status: "ACTIVE", activeSessionId: session.id, installationId: input.installationId, deviceId: input.deviceId ?? null, deviceName: input.deviceName ?? null, platform: input.platform ?? null, appVersion: input.appVersion ?? null, lastLoginAt: now, lastActiveAt: now } });
    return { session, resumed: false };
  });
}

export async function isAppClientSessionActive(sessionId: string, userId: string) {
  const session = await prisma.appClientSession.findUnique({ where: { sessionId }, select: { userId: true, status: true } });
  return Boolean(session && session.userId === userId && session.status === AppClientSessionStatus.ACTIVE);
}

export async function touchAppClientSession(sessionId: string) {
  const current = await prisma.appClientSession.findUnique({ where: { sessionId }, select: { id: true, slotId: true, status: true, lastActiveAt: true } });
  if (!current || current.status !== AppClientSessionStatus.ACTIVE) return null;
  const now = new Date();
  if (now.getTime() - current.lastActiveAt.getTime() < CLIENT_HEARTBEAT_WRITE_INTERVAL_MS) return current;
  const updated = await prisma.appClientSession.updateMany({ where: { id: current.id, status: AppClientSessionStatus.ACTIVE }, data: { lastActiveAt: now } });
  if (updated.count) await prisma.appClientSlot.updateMany({ where: { id: current.slotId, status: "ACTIVE" }, data: { lastActiveAt: now } });
  return { ...current, lastActiveAt: updated.count ? now : current.lastActiveAt };
}

export async function closeAppClientSession(sessionId: string, status: "LOGGED_OUT" | "REVOKED", reason?: string) {
  return prisma.$transaction(async (tx) => {
    const session = await tx.appClientSession.findUnique({ where: { sessionId } });
    if (!session || session.status !== AppClientSessionStatus.ACTIVE) return session;
    const now = new Date();
    await tx.appClientSession.update({ where: { id: session.id }, data: { status, logoutAt: status === "LOGGED_OUT" ? now : null, revokedAt: status === "REVOKED" ? now : null, revokeReason: status === "REVOKED" ? reason ?? "Revoked by administrator" : null } });
    await tx.appClientSlot.updateMany({ where: { id: session.slotId, activeSessionId: session.id }, data: { status: "AVAILABLE", activeSessionId: null, lastLogoutAt: now } });
    return session;
  });
}

export async function listAppCloserActivity(tenantId: string) {
  const users = await prisma.appAuthUser.findMany({ where: { tenantId, role: "SALES_AGENT" }, orderBy: { displayName: "asc" }, select: { id: true, displayName: true, email: true, phone: true, role: true } });
  const ids = users.map((user) => user.id);
  const [slots, sessions] = await Promise.all([
    prisma.appClientSlot.findMany({ where: { tenantId, userId: { in: ids } } }),
    prisma.appClientSession.findMany({ where: { tenantId, userId: { in: ids } }, orderBy: { createdAt: "desc" } }),
  ]);
  const sessionsById = new Map(sessions.map((session) => [session.id, session]));
  const sessionsByUserChannel = new Map<string, typeof sessions>();
  for (const session of sessions) {
    const key = `${session.userId}:${session.channel}`;
    const list = sessionsByUserChannel.get(key) ?? [];
    list.push(session);
    sessionsByUserChannel.set(key, list);
  }
  const build = (userId: string, channel: AppClientChannel) => {
    const slot = slots.find((item) => item.userId === userId && item.channel === channel);
    const current = slot?.activeSessionId ? sessionsById.get(slot.activeSessionId) : null;
    const last = sessionsByUserChannel.get(`${userId}:${channel}`)?.[0] ?? null;
    const status = current?.status === "ACTIVE" ? (Date.now() - current.lastActiveAt.getTime() <= CLIENT_ACTIVITY_WINDOW_MS ? "ONLINE" : "OFFLINE") : last?.status === "REVOKED" ? "REVOKED" : last ? "OFFLINE" : "NEVER_CONNECTED";
    return { status, lastLoginAt: slot?.lastLoginAt?.toISOString() ?? last?.loginAt.toISOString() ?? null, lastActiveAt: current?.lastActiveAt.toISOString() ?? last?.lastActiveAt.toISOString() ?? null, sessionId: current?.sessionId ?? null, deviceId: current?.deviceId ?? last?.deviceId ?? null, deviceName: current?.deviceName ?? last?.deviceName ?? null, platform: current?.platform ?? last?.platform ?? null, appVersion: current?.appVersion ?? last?.appVersion ?? null };
  };
  return users.map((user) => ({ userId: user.id, displayName: user.displayName, email: user.email, phone: user.phone, role: user.role, mobile: build(user.id, AppClientChannel.MOBILE), desktop: build(user.id, AppClientChannel.DESKTOP) }));
}
