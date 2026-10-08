import "server-only";
import { prisma } from "@/lib/prisma";
import { encryptConnectedSecret } from "@/lib/connected-platform/secret-box";
import type { DummyInstagramConnectionState, DummyWhatsAppConnectionState } from "@/lib/gigxomi/dummy-platform-store";
import type { Prisma } from "@prisma/client";
import { encryptSecureToken } from "@/lib/whatsapp-marketing/config";

// Only explicit integration updates call this. A conversation snapshot must
// never replace credentials from another worker with an older copy.
export async function persistMetaConnection(provider: "WHATSAPP" | "INSTAGRAM", state: DummyWhatsAppConnectionState | DummyInstagramConnectionState) {
  if (!process.env.DATABASE_URL) return;
  return prisma.$transaction(async (database) => {
  const owner = await database.appAuthUser.findFirst({ where: { tenantId: state.tenantId, role: "ADMIN" }, orderBy: { createdAt: "asc" }, select: { id: true } });
  if (!owner) throw new Error("Workspace integration owner not found.");
  const { accessToken, ...safeState } = state;
  const metadata = { setupState: { ...safeState, ...("authorizationCode" in safeState ? { authorizationCode: "" } : {}) } } as unknown as Prisma.InputJsonValue;
  const externalAccountId = "phoneNumberId" in state ? state.phoneNumberId : state.instagramBusinessAccountId;
  const data = {
    externalAccountId,
    displayName: state.displayName,
    accessTokenCiphertext: accessToken ? encryptConnectedSecret(accessToken) : null,
    status: !state.pluginEnabled ? "REVOKED" as const : state.lastError ? "ERROR" as const : accessToken && externalAccountId ? "CONNECTED" as const : "PENDING" as const,
    lastError: state.lastError || null,
    metadata,
  };
  await database.appSocialConnection.upsert({ where: { userId_provider: { userId: owner.id, provider } }, create: { userId: owner.id, provider, ...data }, update: data });
  if (provider === "WHATSAPP" && "phoneNumberId" in state && state.phoneNumberId && state.wabaId && accessToken) {
    const channelData = {
      wabaId: state.wabaId,
      displayPhoneNumber: state.phoneNumber || state.phoneNumberId,
      verifiedName: state.displayName || null,
      businessId: state.businessId || null,
      businessPortfolioId: state.businessPortfolioId || null,
      graphApiVersion: state.graphApiVersion,
      encryptedAccessToken: encryptSecureToken(accessToken),
      status: state.pluginEnabled ? "ACTIVE" as const : "DISCONNECTED" as const,
      lastSyncedAt: new Date(),
    };
    const existing = await database.whatsAppChannel.findUnique({ where: { phoneNumberId: state.phoneNumberId }, select: { id: true, tenantId: true } });
    if (existing && existing.tenantId !== state.tenantId) throw new Error("WhatsApp number already belongs to another workspace.");
    if (existing) await database.whatsAppChannel.updateMany({ where: { id: existing.id, tenantId: state.tenantId }, data: channelData });
    else await database.whatsAppChannel.create({ data: { ...channelData, tenantId: state.tenantId, phoneNumberId: state.phoneNumberId, isDefault: true } });
  }
  }, { isolationLevel: "Serializable" });
}
