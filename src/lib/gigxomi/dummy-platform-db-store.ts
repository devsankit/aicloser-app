import "server-only";

import path from "node:path";
import { readFile } from "node:fs/promises";

import type { Prisma } from "@prisma/client";

import { buildSalesWhatsAppTenantId } from "@/lib/api/resolve-session-tenant";
import { decryptConnectedSecret } from "@/lib/connected-platform/secret-box";
import { prisma } from "@/lib/prisma";
import { transformSnapshotSecrets } from "@/lib/meta/snapshot-secrets";
import { getDummyPlatformSnapshot, type DummyConversation, type DummyPlatformSnapshot, type DummyService, type DummyWhatsAppConnectionState } from "@/lib/gigxomi/dummy-platform-store";

const LEGACY_STORE_PATH = path.join(process.cwd(), ".gigxomi", "local-platform-store.json");
let bootstrapPromise: Promise<void> | null = null;
let legacySnapshotCache: DummyPlatformSnapshot | null = null;
type StoredServiceRow = { payload: unknown };
type StoredConversationRow = { payload: unknown };
type StoredServiceMetaRow = { id: string; updatedAt: Date; payload: unknown };
type StoredConversationMetaRow = { id: string; updatedAt: Date; payload: unknown };
type StoredWhatsAppSocialConnection = {
  userId: string;
  status: string;
  externalAccountId: string | null;
  displayName: string | null;
  accessTokenCiphertext: string | null;
  lastError: string | null;
  metadata: unknown;
  updatedAt: Date;
  user: { tenantId: string | null };
};

const DEFAULT_AUTH_WHATSAPP_PHONE = "+91 99933 28124";
const PUBLIC_AUTH_WHATSAPP_TENANT_FALLBACK = "tenant-agency-408de269";

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function jsonRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function resolveWhatsAppPhoneNumber(metadata?: Record<string, unknown>, fallbackPhone?: string): string {
  const phoneFromEnv =
    text(process.env.GIGXOMI_PUBLIC_AUTH_WHATSAPP_NUMBER) ||
    text(process.env.META_CAPI_WHATSAPP_RECIPIENT) ||
    text(process.env.WHATSAPP_PHONE_NUMBER);
  if (phoneFromEnv) {
    return phoneFromEnv.startsWith("+") ? phoneFromEnv : `+91 ${phoneFromEnv.replace(/^91/, "")}`;
  }

  const metaPhone =
    text(metadata?.displayPhoneNumber) ||
    text(metadata?.phoneNumber) ||
    text(metadata?.display_phone_number);
  if (metaPhone) return metaPhone;

  return fallbackPhone || DEFAULT_AUTH_WHATSAPP_PHONE;
}

function decryptStoredToken(ciphertext: string | null) {
  if (!ciphertext?.trim()) return "";
  try {
    return decryptConnectedSecret(ciphertext);
  } catch {
    return "";
  }
}

function recoverPublicWhatsAppStateFromEnvironment(
  fallback: DummyWhatsAppConnectionState,
): DummyWhatsAppConnectionState | null {
  const phoneNumberId =
    text(process.env.WHATSAPP_PHONE_NUMBER_ID) ||
    text(process.env.META_WHATSAPP_PHONE_NUMBER_ID) ||
    text(process.env.META_CAPI_WHATSAPP_PHONE_NUMBER_ID) ||
    text(process.env.GIGXOMI_PUBLIC_AUTH_WHATSAPP_PHONE_NUMBER_ID);
  if (!phoneNumberId) return null;

  const accessToken =
    text(process.env.WHATSAPP_ACCESS_TOKEN) ||
    text(process.env.META_WHATSAPP_ACCESS_TOKEN) ||
    text(process.env.META_CAPI_WHATSAPP_ACCESS_TOKEN);
  const tenantId =
    text(process.env.GIGXOMI_PUBLIC_AUTH_TENANT_ID) ||
    text(process.env.META_CAPI_WHATSAPP_TENANT_ID) ||
    PUBLIC_AUTH_WHATSAPP_TENANT_FALLBACK;
  const wabaId = text(process.env.WHATSAPP_BUSINESS_ACCOUNT_ID) || text(process.env.META_WHATSAPP_BUSINESS_ACCOUNT_ID);
  const metaAppId = text(process.env.META_WHATSAPP_APP_ID) || text(process.env.META_APP_ID) || fallback.metaAppId;
  const resolvedPhone = resolveWhatsAppPhoneNumber(undefined, fallback.phoneNumber);

  return {
    ...fallback,
    tenantId,
    phoneNumber: resolvedPhone,
    pluginEnabled: true,
    status: accessToken ? "Ready for webhook" : "Number connected",
    note: accessToken
      ? "Recovered the Agency public WhatsApp line from protected deployment configuration."
      : "Recovered the Agency inbound WhatsApp identity from protected deployment configuration; add the server access token to enable outgoing messages.",
    metaAppId,
    wabaId: wabaId || fallback.wabaId,
    phoneNumberId,
    accessToken,
    lastError: accessToken ? "" : "The Agency WhatsApp access token is not configured on the server.",
    updatedAt: new Date().toISOString(),
  };
}

function recoverWhatsAppStateFromSocialConnection(
  connection: StoredWhatsAppSocialConnection,
  fallback: DummyWhatsAppConnectionState,
): DummyWhatsAppConnectionState | null {
  const tenantId = text(connection.user.tenantId);
  const metadata = jsonRecord(connection.metadata);
  const setupState = jsonRecord(metadata.setupState);
  if (setupState.tenantId === tenantId) {
    return { ...fallback, ...setupState, tenantId, accessToken: decryptStoredToken(connection.accessTokenCiphertext), authorizationCode: "" } as DummyWhatsAppConnectionState;
  }
  const phoneNumberId = text(metadata.phoneNumberId) || text(connection.externalAccountId);
  if (!tenantId || !phoneNumberId) return null;

  const accessToken = decryptStoredToken(connection.accessTokenCiphertext);
  const resolvedPhone = resolveWhatsAppPhoneNumber(metadata, fallback.phoneNumber);
  return {
    ...fallback,
    tenantId,
    businessName: text(connection.displayName) || fallback.businessName,
    displayName: text(connection.displayName) || fallback.displayName,
    phoneNumber: resolvedPhone,
    pluginEnabled: true,
    status: connection.status === "CONNECTED" ? "Ready for webhook" : "Number connected",
    note: connection.status === "CONNECTED"
      ? "Recovered the Agency WhatsApp connection from the encrypted server-side integration record."
      : "Recovered the Agency WhatsApp identity from the server-side integration record; complete any remaining Meta setup to enable outgoing messages.",
    businessId: text(metadata.businessId) || fallback.businessId,
    wabaId: text(metadata.wabaId) || fallback.wabaId,
    phoneNumberId,
    accessToken: accessToken || fallback.accessToken,
    lastError: text(connection.lastError),
    updatedAt: connection.updatedAt.toISOString(),
  };
}

function hasChangedPayload(existingPayload: unknown, nextPayload: unknown) {
  return JSON.stringify(existingPayload) !== JSON.stringify(nextPayload);
}

function stripDbBackedCollections(snapshot: DummyPlatformSnapshot) {
  return {
    ...snapshot,
    services: [],
    conversations: [],
  } satisfies DummyPlatformSnapshot;
}

async function readLegacySnapshotFile() {
  try {
    const contents = await readFile(LEGACY_STORE_PATH, "utf8");
    return transformSnapshotSecrets(JSON.parse(contents) as DummyPlatformSnapshot, "decrypt");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    return getDummyPlatformSnapshot();
  }
}

async function readLegacySnapshot() {
  if (legacySnapshotCache) {
    return legacySnapshotCache;
  }

  legacySnapshotCache = {
    ...stripDbBackedCollections(getDummyPlatformSnapshot()),
    ...(await readLegacySnapshotFile()),
    services: [],
    conversations: [],
  } satisfies DummyPlatformSnapshot;
  return legacySnapshotCache;
}

async function ensureBootstrapped() {
  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      const [serviceCount, conversationCount] = await Promise.all([
        prisma.appFreelancerService.count(),
        prisma.appConversation.count(),
      ]);

      const importLegacyConversations = process.env.ENABLE_LEGACY_CONVERSATION_IMPORT === "true";
      if (serviceCount > 0 && (conversationCount > 0 || !importLegacyConversations)) {
        return;
      }

      const legacy = await readLegacySnapshotFile();

      if (serviceCount === 0) {
        for (const service of legacy.services ?? []) {
          await prisma.appFreelancerService.upsert({
            where: { id: service.id },
            create: {
              id: service.id,
              slug: service.slug,
              ownerId: service.ownerId,
              ownerName: service.ownerName,
              ownerAlias: service.ownerAlias,
              status: service.status,
              payload: service as Prisma.InputJsonValue,
              createdAt: service.createdAt ? new Date(service.createdAt) : new Date(),
              updatedAt: service.updatedAt ? new Date(service.updatedAt) : new Date(),
            },
            update: {},
          });
        }
      }

      for (const conversation of importLegacyConversations && conversationCount === 0 ? legacy.conversations ?? [] : []) {
        await prisma.appConversation.upsert({
          where: { id: conversation.id },
          create: {
            id: conversation.id,
            tenantId: conversation.tenantId,
            serviceId: conversation.serviceId,
            serviceSlug: conversation.serviceSlug,
            assignedFreelancerId: conversation.assignedFreelancerId ?? null,
            assignedFreelancerName: conversation.assignedFreelancerName ?? null,
            customerName: conversation.customerName,
            customerPhone: conversation.customerPhone,
            status: conversation.status,
            leadStatusId: conversation.leadStatusId,
            payload: conversation as Prisma.InputJsonValue,
            createdAt: conversation.createdAt ? new Date(conversation.createdAt) : new Date(),
            updatedAt: conversation.updatedAt ? new Date(conversation.updatedAt) : new Date(),
          },
          update: {},
        });
      }
    })();
  }

  return bootstrapPromise;
}

export async function readPlatformSnapshotFromDb() {
  await ensureBootstrapped();
  const legacy = await readLegacySnapshot();
  const [services, conversations, agencyUsers, whatsappSocialConnections, instagramSocialConnections] = await Promise.all([
    prisma.appFreelancerService.findMany({ orderBy: { updatedAt: "desc" } }),
    prisma.appConversation.findMany({ orderBy: { updatedAt: "desc" } }),
    prisma.appAuthUser.findMany({
      where: {
        id: { not: "super-admin-owner" },
        AND: [
          { OR: [{ packageAudience: null }, { packageAudience: { not: "FREELANCER" } }] },
          {
            OR: [
              { packageAudience: "AGENCY" },
              { workspaceMode: "AGENCY" },
              { role: { in: ["ADMIN", "MANAGER", "SALES_AGENT"] } },
              { assignedRole: { in: ["ADMIN", "MANAGER", "SALES_AGENT"] } },
            ],
          },
        ],
      },
      select: { assignedRole: true, id: true, role: true, tenantId: true },
    }),
    prisma.appSocialConnection.findMany({
      where: {
        provider: "WHATSAPP",
        user: { tenantId: { not: null } },
      },
      orderBy: { updatedAt: "desc" },
      select: {
        userId: true,
        status: true,
        externalAccountId: true,
        displayName: true,
        accessTokenCiphertext: true,
        lastError: true,
        metadata: true,
        updatedAt: true,
        user: { select: { tenantId: true } },
      },
    }),
    prisma.appSocialConnection.findMany({ where: { provider: "INSTAGRAM", user: { tenantId: { not: null } } }, orderBy: { updatedAt: "desc" }, include: { user: { select: { tenantId: true } } } }),
  ]);

  const activeTenantIds = new Set([
    "tenant-gigxomi",
    ...agencyUsers.map((user) => user.tenantId?.trim()).filter((tenantId): tenantId is string => Boolean(tenantId)),
    ...agencyUsers
      .filter((user) => user.role === "SALES_AGENT" || user.assignedRole === "SALES_AGENT")
      .map((user) => buildSalesWhatsAppTenantId(user.id)),
  ]);
  const legacyWhatsAppStates = (legacy.whatsappStates ?? [])
    .filter((state) => activeTenantIds.has(state.tenantId))
    .map((state): DummyWhatsAppConnectionState => {
      const oldMainNumber = state.tenantId === "tenant-gigxomi" && state.phoneNumber.replace(/\D/g, "").endsWith("6267605079");
      if (!oldMainNumber) return state;

      return {
        ...state,
        phoneNumber: "+91 99818 07309",
        pluginEnabled: false,
        status: "Business submitted",
        note: "Previous agency line cleared. Complete embedded signup for +91 99818 07309.",
        businessId: "",
        businessPortfolioId: "",
        wabaId: "",
        phoneNumberId: "",
        systemUserId: "",
        authorizationCode: "",
        accessToken: "",
        lastInboundAt: "",
        lastOutboundAt: "",
        lastError: "",
        lastSignupEvent: "",
        lastSignupEventAt: "",
        updatedAt: new Date().toISOString(),
      };
    });
  const socialRecoveredStates = (whatsappSocialConnections as StoredWhatsAppSocialConnection[])
    .map((connection) =>
      recoverWhatsAppStateFromSocialConnection(
        connection,
        legacyWhatsAppStates.find((state) => state.tenantId === connection.user.tenantId) ?? getDummyPlatformSnapshot().whatsappStates[0],
      ),
    )
    .filter((state): state is DummyWhatsAppConnectionState => Boolean(state))
    .filter((state) => activeTenantIds.has(state.tenantId));
  const environmentRecoveredState = recoverPublicWhatsAppStateFromEnvironment(
    legacyWhatsAppStates.find((state) => state.tenantId === (text(process.env.GIGXOMI_PUBLIC_AUTH_TENANT_ID) || PUBLIC_AUTH_WHATSAPP_TENANT_FALLBACK))
      ?? getDummyPlatformSnapshot().whatsappStates[0],
  );
  const recoveredStates = [
    ...(environmentRecoveredState && activeTenantIds.has(environmentRecoveredState.tenantId) ? [environmentRecoveredState] : []),
    ...socialRecoveredStates.filter((state) => state.tenantId !== environmentRecoveredState?.tenantId),
  ];
  const recoveredTenantIds = new Set(recoveredStates.map((state) => state.tenantId));
  const whatsappStates = [
    ...recoveredStates,
    ...legacyWhatsAppStates.filter((state) => !recoveredTenantIds.has(state.tenantId)),
  ];

  return {
    ...legacy,
    whatsappStates,
    instagramStates: [
      ...instagramSocialConnections.flatMap((connection) => {
        const setupState = jsonRecord(jsonRecord(connection.metadata).setupState);
        if (setupState.tenantId !== connection.user.tenantId) return [];
        return [{ ...setupState, accessToken: decryptStoredToken(connection.accessTokenCiphertext) } as DummyPlatformSnapshot["instagramStates"][number]];
      }),
      ...legacy.instagramStates.filter((state) => !instagramSocialConnections.some((connection) => connection.user.tenantId === state.tenantId)),
    ],
    services: (services as StoredServiceRow[]).map((record: StoredServiceRow) => record.payload as DummyService),
    conversations: (conversations as StoredConversationRow[]).map((record: StoredConversationRow) => record.payload as DummyConversation),
  } satisfies DummyPlatformSnapshot;
}

export async function writePlatformSnapshotToDb(snapshot: DummyPlatformSnapshot) {
  await ensureBootstrapped();
  legacySnapshotCache = stripDbBackedCollections(snapshot);

  const [existingServices, existingConversations] = await Promise.all([
    prisma.appFreelancerService.findMany({
      select: { id: true, updatedAt: true, payload: true },
    }),
    prisma.appConversation.findMany({
      select: { id: true, updatedAt: true, payload: true },
    }),
  ]);

  const existingServiceMap = new Map(
    (existingServices as StoredServiceMetaRow[]).map((record) => [record.id, record]),
  );
  const existingConversationMap = new Map(
    (existingConversations as StoredConversationMetaRow[]).map((record) => [record.id, record]),
  );

  const operations: Prisma.PrismaPromise<unknown>[] = [];
  // The webhook and dashboard workers each assemble their own snapshot. A
  // missing item means "not loaded", not "delete it"; deleting here lets a
  // stale worker erase a just-arrived WhatsApp conversation before the inbox
  // can render it. Explicit delete operations remain responsible for removal.

  for (const service of snapshot.services ?? []) {
    const nextUpdatedAt = service.updatedAt ? new Date(service.updatedAt) : new Date();
    const existing = existingServiceMap.get(service.id);
    if (
      !existing ||
      existing.updatedAt.getTime() !== nextUpdatedAt.getTime() ||
      hasChangedPayload(existing.payload, service)
    ) {
      operations.push(
        prisma.appFreelancerService.upsert({
          where: { id: service.id },
          create: {
            id: service.id,
            slug: service.slug,
            ownerId: service.ownerId,
            ownerName: service.ownerName,
            ownerAlias: service.ownerAlias,
            status: service.status,
            payload: service as Prisma.InputJsonValue,
            createdAt: service.createdAt ? new Date(service.createdAt) : new Date(),
            updatedAt: nextUpdatedAt,
          },
          update: {
            slug: service.slug,
            ownerId: service.ownerId,
            ownerName: service.ownerName,
            ownerAlias: service.ownerAlias,
            status: service.status,
            payload: service as Prisma.InputJsonValue,
            createdAt: service.createdAt ? new Date(service.createdAt) : new Date(),
            updatedAt: nextUpdatedAt,
          },
        }),
      );
    }
  }

  for (const conversation of snapshot.conversations ?? []) {
    const nextUpdatedAt = conversation.updatedAt ? new Date(conversation.updatedAt) : new Date();
    const existing = existingConversationMap.get(conversation.id);
    if (
      !existing ||
      existing.updatedAt.getTime() !== nextUpdatedAt.getTime() ||
      hasChangedPayload(existing.payload, conversation)
    ) {
      operations.push(
        prisma.appConversation.upsert({
          where: { id: conversation.id },
          create: {
            id: conversation.id,
            tenantId: conversation.tenantId,
            serviceId: conversation.serviceId,
            serviceSlug: conversation.serviceSlug,
            assignedFreelancerId: conversation.assignedFreelancerId ?? null,
            assignedFreelancerName: conversation.assignedFreelancerName ?? null,
            customerName: conversation.customerName,
            customerPhone: conversation.customerPhone,
            status: conversation.status,
            leadStatusId: conversation.leadStatusId,
            payload: conversation as Prisma.InputJsonValue,
            createdAt: conversation.createdAt ? new Date(conversation.createdAt) : new Date(),
            updatedAt: nextUpdatedAt,
          },
          update: {
            tenantId: conversation.tenantId,
            serviceId: conversation.serviceId,
            serviceSlug: conversation.serviceSlug,
            assignedFreelancerId: conversation.assignedFreelancerId ?? null,
            assignedFreelancerName: conversation.assignedFreelancerName ?? null,
            customerName: conversation.customerName,
            customerPhone: conversation.customerPhone,
            status: conversation.status,
            leadStatusId: conversation.leadStatusId,
            payload: conversation as Prisma.InputJsonValue,
            createdAt: conversation.createdAt ? new Date(conversation.createdAt) : new Date(),
            updatedAt: nextUpdatedAt,
          },
        }),
      );
    }
  }

  if (operations.length) {
    try {
      const CHUNK_SIZE = 15;
      for (let i = 0; i < operations.length; i += CHUNK_SIZE) {
        const chunk = operations.slice(i, i + CHUNK_SIZE);
        await prisma.$transaction(chunk);
      }
    } catch (error) {
      console.warn("[DB_SNAPSHOT_SYNC_WARNING] Batch upsert error, continuing safely:", error);
    }
  }
}
