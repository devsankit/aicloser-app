import "server-only";

import path from "node:path";
import { readFile } from "node:fs/promises";
import { createHash, randomBytes, randomInt, scryptSync, timingSafeEqual } from "node:crypto";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { normalizePhone as normalizePhoneValue, normalizeIdentifier as normalizeIdentifierValue, normalizePhoneList as normalizePhoneListValue } from "@/lib/auth/normalize";
import { validatePublicDisplayName } from "@/lib/auth/public-display-name";
import type { AppRole, AuthOtpDeliveryMode, CreateInternalUserInput, DemoCredential, ManagedAuthUser, PackageAudience, PackageStatus, WorkspaceMode } from "@/lib/auth/types";
import { SUPER_ADMIN_ALLOWED_OTP_PHONES, SUPER_ADMIN_LOGIN_EMAIL } from "@/lib/auth/super-admin-config";
import { isRegistrationPackageFree } from "@/lib/billing/package-billing";
import { ensureAgencyListingForTenantFromFile } from "@/lib/gigxomi/agency-listing-store";
import { ensureWhatsAppConnectionDraftFromFile, sendStandaloneWhatsAppOtpMessageFromFile } from "@/lib/gigxomi/dummy-platform-file-store";
import { resolvePublicAuthWhatsAppConnection } from "@/lib/auth/public-whatsapp-channel";
import { getPostProductionFixedOtpHash, isPostProductionAgencyIdentity } from "@/lib/auth/post-production-agency-config";
import { ensureFreelancerWorkspace } from "@/lib/gigxomi/freelancer-workspace-store";
import { findRegistrationPackage, listRegistrationPackages } from "@/lib/gigxomi/public-growth-store";
import type { RegistrationPackage } from "@/lib/gigxomi/public-growth-types";

type AuthUserRecord = {
  id: string;
  role: AppRole;
  assignedRole?: AppRole;
  tenantId: string | null;
  displayName: string;
  email: string | null;
  phone: string;
  loginPhoneAliases?: string[];
  packageId?: string | null;
  packageName?: string | null;
  packageAudience?: PackageAudience | null;
  packageStatus?: PackageStatus;
  packageExpiresAt?: string | null;
  workspaceMode?: WorkspaceMode;
  passwordSalt: string;
  passwordHash: string;
  otpCode: string;
  permissions: string[];
  isSeeded: boolean;
  createdAt?: string;
  createdByUserId?: string | null;
  lastLoginAt?: string;
  lastOtpSentAt?: string;
};

type AuthStoreSnapshot = {
  users: AuthUserRecord[];
  challenges: Array<{
    id: string;
    userId: string;
    phone: string;
    codeHash: string;
    expiresAt: string;
    createdAt: string;
    consumedAt?: string;
    attempts: number;
    deliveryMode: AuthOtpDeliveryMode;
  }>;
  resetTokens: Array<{
    id: string;
    userId: string;
    tokenHash: string;
    createdAt: string;
    expiresAt: string;
    usedAt?: string;
  }>;
};

const LEGACY_AUTH_STORE_PATH = path.join(process.cwd(), ".gigxomi", "auth-store.json");
const OTP_TTL_MS = 10 * 60 * 1000;
const RESET_TTL_MS = 30 * 60 * 1000;
const DEFAULT_OTP_CODE = "904290";
const DEFAULT_TENANT_ID = "tenant-gigxomi";
const TEST_MODE = process.env.GIGXOMI_AUTH_TEST_MODE === "false" ? false : process.env.NODE_ENV !== "production";
const ENABLE_LEGACY_AUTH_IMPORT = process.env.GIGXOMI_ENABLE_LEGACY_AUTH_IMPORT === "true";
const ENABLE_DEMO_AUTH_SEED = process.env.GIGXOMI_ENABLE_DEMO_AUTH_SEED === "true";
const SUPER_ADMIN_USER_ID = "user-super-admin";
const SUPER_ADMIN_DISPLAY_NAME = "Ankit Rathore";
const SUPER_ADMIN_FALLBACK_PHONE = "+919981807309";
const META_REVIEW_OTP_CODE = "654321";

type DbAppRole = AppRole;
type DbPackageAudience = Exclude<PackageAudience, null>;
type DbPackageStatus = Exclude<PackageStatus, null>;
type DbWorkspaceMode = Exclude<WorkspaceMode, null>;

const dbRoleMap: Record<AppRole, DbAppRole> = { SUPER_ADMIN: "SUPER_ADMIN", ADMIN: "ADMIN", MANAGER: "MANAGER", SALES_AGENT: "SALES_AGENT", FREELANCER: "FREELANCER" };
const dbAudienceMap: Record<PackageAudience, DbPackageAudience> = { AGENCY: "AGENCY", FREELANCER: "FREELANCER" };
const dbStatusMap: Record<Exclude<PackageStatus, null>, DbPackageStatus> = { ACTIVE: "ACTIVE", PAUSED: "PAUSED", EXPIRED: "EXPIRED" };
const dbWorkspaceMap: Record<Exclude<WorkspaceMode, null>, DbWorkspaceMode> = { AGENCY: "AGENCY", FREELANCER: "FREELANCER" };

type UpdateManagedAuthUserAccessInput = {
  userId: string;
  packageId?: string | null;
  packageStatus?: Exclude<PackageStatus, null>;
  packageExpiresAt?: string | null;
  updatedByUserId?: string | null;
};

const demoCredentials: DemoCredential[] = [
  { role: "FREELANCER", displayName: "Testing Freelancer", email: "freelancer@gigxomi.local", phone: "+919589510954", password: "Freelancer@123", otpCode: META_REVIEW_OTP_CODE },
  ...((ENABLE_DEMO_AUTH_SEED
    ? [
        { role: "MANAGER", displayName: "Rahul Manager", email: "manager@gigxomi.local", phone: "+919000000003", password: "Manager@123", otpCode: DEFAULT_OTP_CODE },
      ]
    : []) as DemoCredential[]),
];

const metaReviewCredentials = demoCredentials.filter((credential) => credential.otpCode === META_REVIEW_OTP_CODE);
const metaReviewCredentialEmails = new Set(metaReviewCredentials.map((credential) => credential.email.toLowerCase()));
const metaReviewCredentialPhones = new Set(
  metaReviewCredentials.flatMap((credential) => normalizePhoneList([credential.phone, ...(credential.phoneAliases ?? [])])),
);

async function ensureAgencyTenantStores(input: {
  tenantId: string | null;
  displayName: string;
  phone: string;
  email?: string | null;
}) {
  if (!input.tenantId?.trim()) {
    return;
  }

  await ensureAgencyListingForTenantFromFile({
    tenantId: input.tenantId,
    publicName: input.displayName,
    ownerName: input.displayName,
    whatsappNumber: input.phone,
    contactEmail: input.email,
  });
  await ensureWhatsAppConnectionDraftFromFile({
    tenantId: input.tenantId,
    businessName: input.displayName,
    displayName: input.displayName,
    phoneNumber: input.phone,
  });
}

const SUPER_ADMIN_LOGIN_EMAIL_LOWER = SUPER_ADMIN_LOGIN_EMAIL.toLowerCase();
const SUPER_ADMIN_ALLOWED_OTP_PHONES_NORMALIZED = Array.from(new Set(SUPER_ADMIN_ALLOWED_OTP_PHONES.map((phone) => normalizePhone(phone)).filter(Boolean)));
const MANAGED_USERS_CACHE_TTL_MS = 15_000;
let bootstrapPromise: Promise<void> | null = null;
let managedUsersCache: { value: ManagedAuthUser[]; loadedAt: number } | null = null;

function invalidateManagedUsersCache() {
  managedUsersCache = null;
}

function nowIso() {
  return new Date().toISOString();
}

function makeId(prefix: string) {
  return `${prefix}-${randomBytes(6).toString("hex")}`;
}

function makeAgencyTenantId() {
  return `tenant-agency-${randomBytes(4).toString("hex")}`;
}

function resolveAgencyTenantId(existing?: { tenantId: string | null; isSeeded: boolean } | null) {
  const tenantId = existing?.tenantId?.trim() ?? "";
  if (tenantId && (tenantId !== DEFAULT_TENANT_ID || existing?.isSeeded)) {
    return tenantId;
  }

  return makeAgencyTenantId();
}

function normalizePhone(value: string) {
  return normalizePhoneValue(value);
}

function normalizeIdentifier(value: string) {
  return normalizeIdentifierValue(value);
}

function normalizePhoneList(values: Array<string | null | undefined>) {
  return normalizePhoneListValue(values);
}

function hashPassword(password: string, salt: string) {
  return scryptSync(password, salt, 64).toString("hex");
}

function hashValue(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function safeCompare(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function isReservedSuperAdminIdentifier(identifier: string) {
  return identifier === SUPER_ADMIN_LOGIN_EMAIL_LOWER || SUPER_ADMIN_ALLOWED_OTP_PHONES_NORMALIZED.includes(identifier);
}

function buildSeededUsers(): AuthUserRecord[] {
  const createdAt = nowIso();
  return demoCredentials.map((credential) => {
    const salt = randomBytes(16).toString("hex");
    return {
      id: credential.role === "SUPER_ADMIN" ? SUPER_ADMIN_USER_ID : `user-${credential.role.toLowerCase().replace(/_/g, "-")}`,
      role: credential.role,
      assignedRole: credential.role,
      tenantId: credential.role === "SUPER_ADMIN" ? null : DEFAULT_TENANT_ID,
      displayName: credential.displayName,
      email: credential.email.toLowerCase(),
      phone: normalizePhone(credential.phone),
      loginPhoneAliases: normalizePhoneList([credential.phone, ...(credential.phoneAliases ?? [])]),
      packageId: null,
      packageName: null,
      packageAudience: null,
      packageStatus: null,
      packageExpiresAt: null,
      workspaceMode: null,
      passwordSalt: salt,
      passwordHash: hashPassword(credential.password, salt),
      otpCode: credential.otpCode,
      permissions: [credential.role.toLowerCase()],
      isSeeded: true,
      createdAt,
      createdByUserId: null,
    } satisfies AuthUserRecord;
  });
}

function resolveAccess(user: ManagedAuthUser): ManagedAuthUser {
  let packageStatus = user.packageStatus ?? null;
  if (user.packageExpiresAt && new Date(user.packageExpiresAt).getTime() <= Date.now()) {
    packageStatus = "EXPIRED";
  } else if (!packageStatus && user.packageId) {
    packageStatus = "ACTIVE";
  }

  // Sales identities are internal CRM accounts. Legacy records can retain a
  // customer package from before their SalesAgentProfile was created; that
  // package must never downgrade the sales session to Freelancer/Agency.
  if (user.role === "SALES_AGENT" || user.assignedRole === "SALES_AGENT") {
    return { ...user, role: "SALES_AGENT", assignedRole: "SALES_AGENT", packageStatus };
  }

  if (user.packageAudience === "AGENCY") {
    const role: AppRole = packageStatus === "ACTIVE" ? "ADMIN" : "FREELANCER";
    return { ...user, role, workspaceMode: role === "ADMIN" ? (user.workspaceMode === "FREELANCER" ? "FREELANCER" : "AGENCY") : "FREELANCER", packageStatus };
  }
  if (user.packageAudience === "FREELANCER") {
    return { ...user, role: "FREELANCER" as const, workspaceMode: "FREELANCER" as const, packageStatus };
  }
  return { ...user, packageStatus };
}

function toManagedAuthUser(user: AuthUserRecord): ManagedAuthUser {
  return resolveAccess({
    id: user.id,
    role: user.role,
    assignedRole: user.assignedRole ?? user.role,
    tenantId: user.tenantId,
    displayName: user.displayName,
    email: user.email ?? "",
    phone: user.phone,
    packageId: user.packageId ?? null,
    packageName: user.packageName ?? null,
    packageAudience: user.packageAudience ?? null,
    packageStatus: user.packageStatus ?? null,
    packageExpiresAt: user.packageExpiresAt ?? null,
    workspaceMode: user.workspaceMode ?? null,
    isSeeded: user.isSeeded,
    createdAt: user.createdAt ?? null,
    createdByUserId: user.createdByUserId ?? null,
    lastLoginAt: user.lastLoginAt,
    lastOtpSentAt: user.lastOtpSentAt,
  });
}

function fromDbUser(user: {
  id: string; role: DbAppRole; assignedRole: DbAppRole; tenantId: string | null; displayName: string; email: string | null; phone: string | null;
  loginPhoneAliases: string[]; packageId: string | null; packageName: string | null; packageAudience: DbPackageAudience | null; packageStatus: DbPackageStatus | null;
  packageExpiresAt: Date | null; workspaceMode: DbWorkspaceMode | null; passwordSalt: string; passwordHash: string; otpCode: string; permissions: string[];
  isSeeded: boolean; createdAt: Date; createdByUserId: string | null; lastLoginAt: Date | null; lastOtpSentAt: Date | null;
}) {
  const raw: AuthUserRecord = {
    id: user.id, role: user.role as AppRole, assignedRole: user.assignedRole as AppRole, tenantId: user.tenantId, displayName: user.displayName, email: user.email, phone: user.phone ?? "",
    loginPhoneAliases: user.loginPhoneAliases, packageId: user.packageId, packageName: user.packageName, packageAudience: user.packageAudience as PackageAudience | null,
    packageStatus: user.packageStatus as PackageStatus, packageExpiresAt: user.packageExpiresAt?.toISOString() ?? null, workspaceMode: user.workspaceMode as WorkspaceMode,
    passwordSalt: user.passwordSalt, passwordHash: user.passwordHash, otpCode: user.otpCode, permissions: user.permissions, isSeeded: user.isSeeded,
    createdAt: user.createdAt.toISOString(), createdByUserId: user.createdByUserId, lastLoginAt: user.lastLoginAt?.toISOString(), lastOtpSentAt: user.lastOtpSentAt?.toISOString(),
  };
  return { raw, managed: toManagedAuthUser(raw) };
}

async function readLegacySnapshot() {
  try {
    const contents = await readFile(LEGACY_AUTH_STORE_PATH, "utf8");
    return JSON.parse(contents) as Partial<AuthStoreSnapshot>;
  } catch {
    return null;
  }
}

async function upsertProtectedSuperAdmin() {
  const existing = await prisma.appAuthUser.findUnique({ where: { id: SUPER_ADMIN_USER_ID } });
  const bootstrapPassword = process.env.GXCLOSERS_SUPER_ADMIN_BOOTSTRAP_PASSWORD?.trim();
  if (!existing && !bootstrapPassword) {
    throw new Error("GXCLOSERS_SUPER_ADMIN_BOOTSTRAP_PASSWORD is required to create the GXClosers owner account.");
  }
  const passwordAlreadyApplied = Boolean(
    existing && bootstrapPassword && safeCompare(hashPassword(bootstrapPassword, existing.passwordSalt), existing.passwordHash),
  );
  const passwordSalt = existing && (!bootstrapPassword || passwordAlreadyApplied) ? existing.passwordSalt : randomBytes(16).toString("hex");
  const passwordHash = existing && (!bootstrapPassword || passwordAlreadyApplied)
    ? existing.passwordHash
    : hashPassword(bootstrapPassword!, passwordSalt);
  const payload = {
    role: dbRoleMap.SUPER_ADMIN,
    assignedRole: dbRoleMap.SUPER_ADMIN,
    tenantId: null,
    displayName: SUPER_ADMIN_DISPLAY_NAME,
    email: SUPER_ADMIN_LOGIN_EMAIL_LOWER,
    phone: existing?.phone ?? normalizePhone(process.env.GXCLOSERS_SUPER_ADMIN_PHONE?.trim() || SUPER_ADMIN_FALLBACK_PHONE),
    loginPhoneAliases: SUPER_ADMIN_ALLOWED_OTP_PHONES_NORMALIZED,
    packageId: null,
    packageName: null,
    packageAudience: null,
    packageStatus: null,
    packageExpiresAt: null,
    workspaceMode: null,
    passwordSalt,
    passwordHash,
    otpCode: DEFAULT_OTP_CODE,
    permissions: ["super_admin"],
    isSeeded: true,
    createdByUserId: null,
    lastLoginAt: null,
    lastOtpSentAt: null,
  };

  if (existing) {
    if (!passwordAlreadyApplied && bootstrapPassword) {
      await prisma.appAuthUser.update({
        where: { id: SUPER_ADMIN_USER_ID },
        data: { passwordSalt, passwordHash },
      });
    }
    return;
  }

  await prisma.appAuthUser.create({
    data: {
      id: SUPER_ADMIN_USER_ID,
      createdAt: new Date(),
      ...payload,
    },
  });
}

async function ensureBootstrapped() {
  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      await upsertProtectedSuperAdmin();
      const existingUserCount = await prisma.appAuthUser.count();
      if (existingUserCount > 1) {
        return;
      }

      // Production signup must remain usable after a clean workspace purge.
      // Demo/Meta-review identities use the legacy tenant-gigxomi tenant and
      // must never be recreated automatically when only the super admin is
      // left in a live database.
      if (process.env.NODE_ENV === "production" && !ENABLE_DEMO_AUTH_SEED) {
        return;
      }

      await upsertMetaReviewTestUsers().catch(() => {});

      const legacy = ENABLE_LEGACY_AUTH_IMPORT ? await readLegacySnapshot() : null;
      const users = Array.isArray(legacy?.users) && legacy.users.length ? legacy.users : buildSeededUsers();
      for (const user of users) {
        if (user.id === SUPER_ADMIN_USER_ID) {
          continue;
        }
        await upsertSeededAuthUser(user);
      }
      for (const challenge of ENABLE_LEGACY_AUTH_IMPORT ? legacy?.challenges ?? [] : []) {
        const userExists = await prisma.appAuthUser.findUnique({ where: { id: challenge.userId }, select: { id: true } });
        if (!userExists) continue;
        await prisma.appAuthChallenge.upsert({
          where: { id: challenge.id },
          create: { id: challenge.id, userId: challenge.userId, phone: normalizePhone(challenge.phone), codeHash: challenge.codeHash, createdAt: new Date(challenge.createdAt), expiresAt: new Date(challenge.expiresAt), consumedAt: challenge.consumedAt ? new Date(challenge.consumedAt) : null, attempts: challenge.attempts ?? 0, deliveryMode: challenge.deliveryMode ?? "local-only" },
          update: {},
        });
      }
      for (const token of ENABLE_LEGACY_AUTH_IMPORT ? legacy?.resetTokens ?? [] : []) {
        const userExists = await prisma.appAuthUser.findUnique({ where: { id: token.userId }, select: { id: true } });
        if (!userExists) continue;
        await prisma.appPasswordResetToken.upsert({
          where: { id: token.id },
          create: { id: token.id, userId: token.userId, tokenHash: token.tokenHash, createdAt: new Date(token.createdAt), expiresAt: new Date(token.expiresAt), usedAt: token.usedAt ? new Date(token.usedAt) : null },
          update: {},
        });
      }
    })();
  }
  return bootstrapPromise;
}

async function findUserRecord(identifier: string) {
  await ensureBootstrapped();
  const normalized = normalizeIdentifier(identifier);
  if (!normalized) return null;
  const user = isReservedSuperAdminIdentifier(normalized)
    ? await prisma.appAuthUser.findUnique({ where: { id: SUPER_ADMIN_USER_ID } })
    : await prisma.appAuthUser.findFirst({
        where: normalized.includes("@")
          ? { NOT: { id: SUPER_ADMIN_USER_ID }, email: normalized }
          : { NOT: { id: SUPER_ADMIN_USER_ID }, OR: [{ phone: normalized }, { loginPhoneAliases: { has: normalized } }] },
      });
  return user ? fromDbUser(user) : null;
}

function getDemoCredentialForUser(user: { email: string | null; isSeeded: boolean }) {
  return demoCredentials.find((credential) => credential.email === user.email) ?? null;
}

function isMetaReviewCredentialUser(user: { email: string | null; phone?: string | null; loginPhoneAliases?: string[] | null }) {
  const email = user.email?.trim().toLowerCase() ?? "";
  if (email && metaReviewCredentialEmails.has(email)) {
    return true;
  }

  return normalizePhoneList([user.phone, ...(user.loginPhoneAliases ?? [])]).some((phone) => metaReviewCredentialPhones.has(phone));
}

function buildOtpCode(user: { email: string | null; phone?: string | null; loginPhoneAliases?: string[] | null; isSeeded: boolean }) {
  if (user.email?.toLowerCase() === SUPER_ADMIN_LOGIN_EMAIL_LOWER) {
    return DEFAULT_OTP_CODE;
  }

  if (isMetaReviewCredentialUser(user)) {
    return META_REVIEW_OTP_CODE;
  }

  return TEST_MODE && user.isSeeded ? getDemoCredentialForUser(user)?.otpCode ?? DEFAULT_OTP_CODE : String(randomInt(100000, 1000000));
}

async function issueOtpChallengeForUser(user: AuthUserRecord, options?: { deliveryPhone?: string | null }) {
  if (user.role === "SUPER_ADMIN") {
    throw new Error("Super-admin phone OTP is disabled. Sign in with the protected owner email and password.");
  }

  const deliveryPhone = normalizePhone(options?.deliveryPhone ?? user.phone) || normalizePhone(user.phone);
  const createdAt = new Date();
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);
  const usesPreconfiguredCode = isPostProductionAgencyIdentity(user);
  const fixedCodeHash = usesPreconfiguredCode ? getPostProductionFixedOtpHash() : "";
  if (usesPreconfiguredCode && !fixedCodeHash) {
    throw new Error("The agency access-code hash is not configured on the server.");
  }
  const otpCode = usesPreconfiguredCode
    ? ""
    : buildOtpCode({ email: user.email, phone: user.phone, loginPhoneAliases: user.loginPhoneAliases, isSeeded: user.isSeeded });
  const otpConnection = usesPreconfiguredCode ? null : await resolvePublicAuthWhatsAppConnection();
  const delivery = usesPreconfiguredCode
    ? { ok: true, mode: "preconfigured-code" as const }
    : otpConnection
      ? await sendStandaloneWhatsAppOtpMessageFromFile({
          tenantId: otpConnection.tenantId,
          to: deliveryPhone,
          code: otpCode,
          fallbackBody: `${otpCode} is your Gigxomi verification code. Enter the code in Gigxomi to continue. It expires in 10 minutes.`,
        }).catch(() => ({ ok: false, mode: "local-only" as const }))
      : { ok: false, mode: "local-only" as const };

  const deliveryAccepted =
    delivery.mode === "preconfigured-code" ||
    (TEST_MODE && user.isSeeded) ||
    (delivery.ok && delivery.mode === "whatsapp-sent");
  if (!deliveryAccepted) {
    throw new Error("WhatsApp did not accept the OTP delivery. No login challenge was created; retry after the WhatsApp line is ready.");
  }
  const deliveryMode: AuthOtpDeliveryMode =
    delivery.mode === "preconfigured-code"
      ? "preconfigured-code"
      : delivery.ok && delivery.mode === "whatsapp-sent"
        ? "whatsapp-sent"
        : "local-only";

  const [, challenge] = await prisma.$transaction([
    prisma.appAuthChallenge.updateMany({
      where: { userId: user.id, consumedAt: null, expiresAt: { gt: createdAt } },
      data: { consumedAt: createdAt },
    }),
    prisma.appAuthChallenge.create({
      data: {
        id: makeId("otp"),
        userId: user.id,
        phone: deliveryPhone,
        codeHash: fixedCodeHash || hashValue(otpCode),
        createdAt,
        expiresAt,
        attempts: 0,
        deliveryMode,
      },
    }),
  ]);

  await prisma.appAuthUser.update({ where: { id: user.id }, data: { lastOtpSentAt: createdAt } });

  return {
    challengeId: challenge.id,
    user: toManagedAuthUser({ ...user, lastOtpSentAt: createdAt.toISOString() }),
    deliveryMode: challenge.deliveryMode as AuthOtpDeliveryMode,
    expiresAt: expiresAt.toISOString(),
    testCode: TEST_MODE && !usesPreconfiguredCode ? otpCode : undefined,
    usesStaticOtp: usesPreconfiguredCode,
  };
}

function buildFreelancerPlaceholderEmail(phone: string) {
  const digits = phone.replace(/[^\d]/g, "");
  return `${digits || randomBytes(4).toString("hex")}@gigxomi.user.local`;
}

function normalizeNameWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeNameKey(value: string) {
  return normalizeNameWhitespace(value).toLowerCase();
}

async function resolveFreelancerSignupDisplayName(input: { displayName: string; phone: string; existingUserId?: string | null }) {
  const baseName = normalizeNameWhitespace(input.displayName);
  if (!baseName) {
    return input.displayName;
  }

  const takenNames = new Set(
    (
      await prisma.appAuthUser.findMany({
        where: {
          OR: [{ role: "FREELANCER" }, { assignedRole: "FREELANCER" }],
          ...(input.existingUserId ? { NOT: { id: input.existingUserId } } : {}),
        },
        select: { displayName: true },
      })
    ).map((user) => normalizeNameKey(user.displayName)),
  );

  if (!takenNames.has(normalizeNameKey(baseName))) {
    return baseName;
  }

  const digits = input.phone.replace(/[^\d]/g, "");
  const suffixSeed = digits.slice(-4) || randomBytes(2).toString("hex");
  let candidate = `${baseName} ${suffixSeed}`;
  let index = 1;
  while (takenNames.has(normalizeNameKey(candidate))) {
    index += 1;
    candidate = `${baseName} ${suffixSeed}${index}`;
  }
  return candidate;
}

async function findBootstrapTarget(user: AuthUserRecord) {
  if (user.id === SUPER_ADMIN_USER_ID) {
    return prisma.appAuthUser.findUnique({ where: { id: SUPER_ADMIN_USER_ID } });
  }

  const normalizedPhone = normalizePhone(user.phone);
  const normalizedAliases = normalizePhoneList([user.phone, ...(user.loginPhoneAliases ?? [])]);
  const normalizedEmail = user.email?.trim().toLowerCase() || null;

  const existingById = await prisma.appAuthUser.findFirst({
    where: {
      id: user.id,
      NOT: { id: SUPER_ADMIN_USER_ID },
    },
  });
  if (existingById) {
    return existingById;
  }

  if (normalizedEmail) {
    const existingByEmail = await prisma.appAuthUser.findFirst({
      where: {
        email: normalizedEmail,
        NOT: { id: SUPER_ADMIN_USER_ID },
      },
    });
    if (existingByEmail) {
      return existingByEmail;
    }
  }

  return prisma.appAuthUser.findFirst({
    where: {
      NOT: { id: SUPER_ADMIN_USER_ID },
      OR: [
        ...normalizedAliases.flatMap((alias) => [{ phone: alias }, { loginPhoneAliases: { has: alias } }]),
        ...(normalizedPhone ? [{ phone: normalizedPhone }, { loginPhoneAliases: { has: normalizedPhone } }] : []),
      ],
    },
  });
}

async function resolveBootstrapEmail(user: AuthUserRecord, targetUserId: string | null) {
  const normalizedEmail = user.email?.trim().toLowerCase() || null;
  if (!normalizedEmail) {
    return null;
  }

  const emailOwner = await prisma.appAuthUser.findUnique({ where: { email: normalizedEmail } });
  if (!emailOwner || emailOwner.id === targetUserId) {
    return normalizedEmail;
  }

  return buildFreelancerPlaceholderEmail(user.phone);
}

async function upsertSeededAuthUser(user: AuthUserRecord) {
  const existing = await findBootstrapTarget(user);
  const resolvedEmail = await resolveBootstrapEmail(user, existing?.id ?? null);
  const payload = {
    role: dbRoleMap[user.role],
    assignedRole: dbRoleMap[user.assignedRole ?? user.role],
    tenantId: user.tenantId,
    displayName: user.displayName,
    email: resolvedEmail,
    phone: normalizePhone(user.phone),
    loginPhoneAliases: normalizePhoneList([user.phone, ...(user.loginPhoneAliases ?? []), ...(existing?.loginPhoneAliases ?? [])]),
    packageId: user.packageId ?? null,
    packageName: user.packageName ?? null,
    packageAudience: user.packageAudience ? dbAudienceMap[user.packageAudience] : null,
    packageStatus: user.packageStatus ? dbStatusMap[user.packageStatus] : null,
    packageExpiresAt: user.packageExpiresAt ? new Date(user.packageExpiresAt) : null,
    workspaceMode: user.workspaceMode ? dbWorkspaceMap[user.workspaceMode] : null,
    passwordSalt: user.passwordSalt,
    passwordHash: user.passwordHash,
    otpCode: user.otpCode,
    permissions: Array.from(new Set([...(existing?.permissions ?? []), ...(user.permissions ?? [])])),
    isSeeded: user.isSeeded,
    createdAt: user.createdAt ? new Date(user.createdAt) : new Date(),
    createdByUserId: user.createdByUserId ?? null,
    lastLoginAt: user.lastLoginAt ? new Date(user.lastLoginAt) : null,
    lastOtpSentAt: user.lastOtpSentAt ? new Date(user.lastOtpSentAt) : null,
  };

  const record = existing
    ? await prisma.appAuthUser.update({
        where: { id: existing.id },
        data: payload,
      })
    : await prisma.appAuthUser.create({
        data: {
          id: user.id,
          ...payload,
        },
      });

  if (user.role === "ADMIN" && record.tenantId) {
    await ensureAgencyTenantStores({
      tenantId: record.tenantId,
      displayName: record.displayName,
      phone: record.phone ?? "",
      email: record.email,
    });
  }

  if (user.role === "FREELANCER") {
    await ensureFreelancerWorkspace(record.id, {
      userId: record.id,
      displayName: record.displayName,
      email: record.email,
      phone: record.phone ?? "",
    });
  }

  invalidateManagedUsersCache();
  return record;
}

function applyPackageToSeededUser(user: AuthUserRecord, pkg: RegistrationPackage | null | undefined): AuthUserRecord {
  if (!pkg) {
    return user;
  }

  return {
    ...user,
    role: pkg.audience === "AGENCY" ? "ADMIN" : "FREELANCER",
    assignedRole: pkg.audience === "AGENCY" ? "ADMIN" : "FREELANCER",
    tenantId: pkg.audience === "AGENCY" ? user.tenantId || DEFAULT_TENANT_ID : user.tenantId,
    packageId: pkg.id,
    packageName: pkg.name,
    packageAudience: pkg.audience,
    packageStatus: "ACTIVE",
    packageExpiresAt: new Date(Date.now() + pkg.durationDays * 24 * 60 * 60 * 1000).toISOString(),
    workspaceMode: pkg.audience,
    permissions: [pkg.audience === "AGENCY" ? "admin" : "freelancer"],
  };
}

async function upsertMetaReviewTestUsers() {
  const packages = await listRegistrationPackages().catch(() => []);
  const packageByAudience = {
    AGENCY: packages
      .filter((pkg) => pkg.audience === "AGENCY" && pkg.isActive !== false)
      .sort((left, right) => left.sortOrder - right.sortOrder)[0],
    FREELANCER: packages
      .filter((pkg) => pkg.audience === "FREELANCER" && pkg.isActive !== false)
      .sort((left, right) => left.sortOrder - right.sortOrder)[0],
  };
  const users = buildSeededUsers()
    .filter((user) => user.role === "ADMIN" || user.role === "FREELANCER")
    .map((user) => applyPackageToSeededUser(user, user.role === "ADMIN" ? packageByAudience.AGENCY : packageByAudience.FREELANCER));
  for (const user of users) {
    await upsertSeededAuthUser(user);
  }
}

export function isAuthTestMode() {
  return TEST_MODE;
}

export function listDemoCredentials() {
  return demoCredentials;
}

export async function findUserByIdentifier(identifier: string) {
  return (await findUserRecord(identifier))?.managed ?? null;
}

export async function authenticatePassword(identifier: string, password: string, options: { updateLastLogin?: boolean } = {}) {
  const user = await findUserRecord(identifier);
  if (!user) return null;
  const expectedHash = hashPassword(password, user.raw.passwordSalt);
  if (!safeCompare(expectedHash, user.raw.passwordHash)) return null;
  if (options.updateLastLogin === false) return user.managed;
  const updated = await prisma.appAuthUser.update({ where: { id: user.raw.id }, data: { lastLoginAt: new Date() } });
  return fromDbUser(updated).managed;
}

export async function createOtpChallenge(identifier: string) {
  const user = await findUserRecord(identifier);
  if (!user) return null;
  const normalizedIdentifier = normalizeIdentifier(identifier);
  const deliveryPhone = normalizedIdentifier.includes("@") ? null : normalizedIdentifier;
  return issueOtpChallengeForUser(user.raw, {
    deliveryPhone: deliveryPhone && (user.raw.loginPhoneAliases ?? []).includes(deliveryPhone) ? deliveryPhone : null,
  });
}

export async function getOtpChallengeMode(identifier: string): Promise<AuthOtpDeliveryMode | "whatsapp-command" | null> {
  const user = await findUserRecord(identifier);
  if (!user || user.raw.role === "SUPER_ADMIN") return null;
  return isPostProductionAgencyIdentity(user.raw) ? "preconfigured-code" : "whatsapp-command";
}

export async function beginPublicOtpSignup(input: {
  displayName: string;
  phone: string;
  email?: string | null;
  packageId: string;
  allowPackageChange?: boolean;
  deferOtpUntilWhatsAppCommand?: boolean;
}) {
  await ensureBootstrapped();
  const displayNameValidation = validatePublicDisplayName(input.displayName);
  const displayName = displayNameValidation.ok ? displayNameValidation.value : "";
  const normalizedPhone = normalizePhone(input.phone);
  const email = input.email?.trim().toLowerCase() ?? "";
  const selectedPackage = await findRegistrationPackage(input.packageId);

  if (!displayName || !normalizedPhone || !input.packageId?.trim()) return { ok: false as const, error: "Full name, WhatsApp number, and package selection are required." };
  if (!displayNameValidation.ok) return { ok: false as const, error: displayNameValidation.error };
  if (email && !email.includes("@")) return { ok: false as const, error: "Enter a valid email address or leave it blank." };
  if (!selectedPackage || !selectedPackage.isActive) return { ok: false as const, error: "That signup package is no longer active. Please choose another option." };

  const matchingPhoneUser = await prisma.appAuthUser.findFirst({ where: { OR: [{ phone: normalizedPhone }, { loginPhoneAliases: { has: normalizedPhone } }] } });
  const matchingEmailUser = email ? await prisma.appAuthUser.findFirst({ where: { email } }) : null;
  if (matchingPhoneUser && matchingEmailUser && matchingPhoneUser.id !== matchingEmailUser.id) {
    return { ok: false as const, error: "That phone number and email belong to different accounts. Please use one existing identity." };
  }

  const existing = matchingPhoneUser ?? matchingEmailUser;
  const nextAssignedRole: AppRole = selectedPackage.audience === "AGENCY" ? "ADMIN" : "FREELANCER";
  const signupDisplayName =
    nextAssignedRole === "FREELANCER"
      ? await resolveFreelancerSignupDisplayName({
          displayName,
          phone: normalizedPhone,
          existingUserId: existing?.id ?? null,
        })
      : displayName;
  const activatesWithoutPayment = isRegistrationPackageFree(selectedPackage);
  const nextPackageStatus: Exclude<PackageStatus, null> = activatesWithoutPayment ? "ACTIVE" : "PAUSED";
  const packageExpiresAt = activatesWithoutPayment ? new Date(Date.now() + selectedPackage.durationDays * 24 * 60 * 60 * 1000) : null;

  if (existing && !existing.packageId && existing.role !== "FREELANCER") {
    return { ok: false as const, error: "That phone or email is already reserved for an internal team account." };
  }

  const existingManagedUser = existing ? fromDbUser(existing).managed : null;
  // Paid signup stores the selected package as PAUSED until payment succeeds.
  // A PAUSED package must remain resumable; only active access should block a
  // second registration attempt or require package-change confirmation.
  const existingPackageIsRunning = Boolean(existingManagedUser?.packageId && existingManagedUser.packageStatus === "ACTIVE");
  const requestedPackageMatchesExisting = existingPackageIsRunning && existingManagedUser?.packageId === selectedPackage.id;
  const nextTenantId =
    selectedPackage.audience === "AGENCY"
      ? resolveAgencyTenantId(existing)
      : existing?.tenantId || DEFAULT_TENANT_ID;

  if (requestedPackageMatchesExisting) {
    return {
      ok: false as const,
      error: `This WhatsApp number already has ${existingManagedUser?.packageName ?? "an active package"} running. Login with OTP to continue.`,
      conflict: {
        kind: "same-package" as const,
        existingPackageId: existingManagedUser?.packageId ?? "",
        existingPackageName: existingManagedUser?.packageName ?? "Active package",
        existingPackageAudience: existingManagedUser?.packageAudience ?? selectedPackage.audience,
        requestedPackageId: selectedPackage.id,
        requestedPackageName: selectedPackage.name,
        requestedPackageAudience: selectedPackage.audience,
      },
    };
  }

  if (existingPackageIsRunning && !requestedPackageMatchesExisting && !input.allowPackageChange) {
    return {
      ok: false as const,
      error: `This WhatsApp number already has ${existingManagedUser?.packageName ?? "an active package"} running. Confirm the package change before we send OTP.`,
      conflict: {
        kind: "package-change" as const,
        existingPackageId: existingManagedUser?.packageId ?? "",
        existingPackageName: existingManagedUser?.packageName ?? "Active package",
        existingPackageAudience: existingManagedUser?.packageAudience ?? null,
        requestedPackageId: selectedPackage.id,
        requestedPackageName: selectedPackage.name,
        requestedPackageAudience: selectedPackage.audience,
      },
    };
  }

  const record = existing
    ? await prisma.appAuthUser.update({
        where: { id: existing.id },
        data: {
          role: dbRoleMap[nextAssignedRole],
          assignedRole: dbRoleMap[nextAssignedRole],
          tenantId: nextTenantId,
          displayName: signupDisplayName,
          email: email || buildFreelancerPlaceholderEmail(normalizedPhone),
          phone: normalizedPhone,
          loginPhoneAliases: normalizePhoneList([normalizedPhone, ...(existing.loginPhoneAliases ?? [])]),
          packageId: selectedPackage.id,
          packageName: selectedPackage.name,
          packageAudience: dbAudienceMap[selectedPackage.audience],
          packageStatus: nextPackageStatus,
          packageExpiresAt,
          workspaceMode: selectedPackage.audience === "AGENCY" ? "AGENCY" : "FREELANCER",
          permissions: Array.from(new Set([...(existing.permissions ?? []), nextAssignedRole.toLowerCase()])),
        },
      })
    : await (async () => {
        const passwordSalt = randomBytes(16).toString("hex");
        return prisma.appAuthUser.create({
          data: {
            id: `user-${nextAssignedRole.toLowerCase()}-${randomBytes(4).toString("hex")}`,
            role: dbRoleMap[nextAssignedRole],
            assignedRole: dbRoleMap[nextAssignedRole],
            tenantId: nextTenantId,
            displayName: signupDisplayName,
            email: email || buildFreelancerPlaceholderEmail(normalizedPhone),
            phone: normalizedPhone,
            loginPhoneAliases: [normalizedPhone],
            packageId: selectedPackage.id,
            packageName: selectedPackage.name,
            packageAudience: dbAudienceMap[selectedPackage.audience],
            packageStatus: nextPackageStatus,
            packageExpiresAt,
            workspaceMode: selectedPackage.audience === "AGENCY" ? "AGENCY" : "FREELANCER",
            passwordSalt,
            passwordHash: hashPassword(randomBytes(24).toString("hex"), passwordSalt),
            otpCode: DEFAULT_OTP_CODE,
            permissions: [nextAssignedRole.toLowerCase()],
            isSeeded: false,
          },
        });
      })();

  if (selectedPackage.audience === "AGENCY" && record.tenantId) {
    await ensureAgencyTenantStores({
      tenantId: record.tenantId,
      displayName: record.displayName,
      phone: record.phone ?? "",
      email: record.email,
    });
  }

  if (selectedPackage.audience === "FREELANCER") {
    await ensureFreelancerWorkspace(record.id, {
      userId: record.id,
      displayName: record.displayName,
      email: record.email,
      phone: record.phone ?? "",
    });
  }

  const preparedUser = fromDbUser(record);
  invalidateManagedUsersCache();
  if (input.deferOtpUntilWhatsAppCommand && !isPostProductionAgencyIdentity(preparedUser.raw)) {
    return {
      ok: true as const,
      isNewUser: !existing,
      user: preparedUser.managed,
      requiresWhatsAppCommand: true as const,
    };
  }

  return { ok: true as const, isNewUser: !existing, ...(await issueOtpChallengeForUser(preparedUser.raw)) };
}

export async function consumeOtpChallenge(challengeId: string, code: string) {
  await ensureBootstrapped();
  const challenge = await prisma.appAuthChallenge.findUnique({ where: { id: challengeId } });
  if (!challenge || challenge.consumedAt) return { ok: false as const, error: "OTP challenge was not found or is no longer active." };
  if (challenge.expiresAt.getTime() <= Date.now()) return { ok: false as const, error: "OTP expired. Please request a new code." };
  const attempts = challenge.attempts + 1;
  if (attempts > 5) {
    await prisma.appAuthChallenge.update({ where: { id: challenge.id }, data: { attempts } });
    return { ok: false as const, error: "Too many OTP attempts. Please request a new code." };
  }
  const incomingHash = hashValue(code.trim());
  const matchesStoredCode = safeCompare(incomingHash, challenge.codeHash);
  const matchesMetaReviewCode =
    !matchesStoredCode && code.trim() === META_REVIEW_OTP_CODE
      ? await prisma.appAuthUser
          .findUnique({
            where: { id: challenge.userId },
            select: { email: true, phone: true, loginPhoneAliases: true },
          })
          .then((user) => (user ? isMetaReviewCredentialUser(user) : false))
      : false;

  if (!matchesStoredCode && !matchesMetaReviewCode) {
    await prisma.appAuthChallenge.update({ where: { id: challenge.id }, data: { attempts } });
    return { ok: false as const, error: "OTP did not match. Please try again." };
  }
  const [, user] = await prisma.$transaction([
    prisma.appAuthChallenge.update({ where: { id: challenge.id }, data: { attempts, consumedAt: new Date() } }),
    prisma.appAuthUser.update({ where: { id: challenge.userId }, data: { lastLoginAt: new Date() } }),
  ]);
  let managedUser = fromDbUser(user).managed;
  managedUser = (await repairAgencyTenantIsolation(managedUser.id)) ?? managedUser;
  return { ok: true as const, user: managedUser };
}

export async function repairAgencyTenantIsolation(userId: string) {
  await ensureBootstrapped();
  const user = await prisma.appAuthUser.findUnique({ where: { id: userId } });
  if (!user) {
    return null;
  }

  const managedUser = fromDbUser(user).managed;
  if (managedUser.packageAudience !== "AGENCY" || managedUser.tenantId !== DEFAULT_TENANT_ID || managedUser.isSeeded) {
    return managedUser;
  }

  const updated = await prisma.appAuthUser.update({
    where: { id: user.id },
    data: {
      tenantId: makeAgencyTenantId(),
      workspaceMode: dbWorkspaceMap.AGENCY,
    },
  });
  const repairedUser = fromDbUser(updated).managed;
  if (repairedUser.tenantId) {
    await ensureAgencyTenantStores({
      tenantId: repairedUser.tenantId,
      displayName: repairedUser.displayName,
      phone: repairedUser.phone,
      email: repairedUser.email,
    });
  }

  return repairedUser;
}

export async function issuePasswordReset(identifier: string) {
  const user = await findUserRecord(identifier);
  if (!user) return null;
  const rawToken = randomBytes(18).toString("hex");
  await prisma.appPasswordResetToken.create({
    data: { id: makeId("reset"), userId: user.raw.id, tokenHash: hashValue(rawToken), createdAt: new Date(), expiresAt: new Date(Date.now() + RESET_TTL_MS) },
  });
  return { user: user.managed, rawToken };
}

export async function resetPasswordWithToken(token: string, nextPassword: string) {
  await ensureBootstrapped();
  const resetToken = await prisma.appPasswordResetToken.findUnique({ where: { tokenHash: hashValue(token.trim()) } });
  if (!resetToken || resetToken.usedAt) return { ok: false as const, error: "Reset token was not found." };
  if (resetToken.expiresAt.getTime() <= Date.now()) return { ok: false as const, error: "Reset token expired. Request a new link." };

  const salt = randomBytes(16).toString("hex");
  await prisma.$transaction([
    prisma.appAuthUser.update({ where: { id: resetToken.userId }, data: { passwordSalt: salt, passwordHash: hashPassword(nextPassword, salt), lastLoginAt: new Date() } }),
    prisma.appPasswordResetToken.update({ where: { id: resetToken.id }, data: { usedAt: new Date() } }),
  ]);
  return { ok: true as const };
}

export async function getManagedAuthUsers() {
  const now = Date.now();
  if (managedUsersCache && now - managedUsersCache.loadedAt <= MANAGED_USERS_CACHE_TTL_MS) {
    return managedUsersCache.value;
  }

  await ensureBootstrapped();
  const users = await prisma.appAuthUser.findMany({ orderBy: { createdAt: "desc" } });
  const managedUsers = users.map((user: Parameters<typeof fromDbUser>[0]) => fromDbUser(user).managed);
  managedUsersCache = { value: managedUsers, loadedAt: now };
  return managedUsers;
}

export async function updateManagedAuthUserAccess(input: UpdateManagedAuthUserAccessInput) {
  await ensureBootstrapped();

  const existing = await prisma.appAuthUser.findUnique({ where: { id: input.userId } });
  if (!existing) {
    return { ok: false as const, error: "User not found." };
  }

  if (existing.id === SUPER_ADMIN_USER_ID) {
    return { ok: false as const, error: "Super admin access is locked and cannot be changed from this panel." };
  }

  const packageIdWasProvided = input.packageId !== undefined;
  const nextPackageId = packageIdWasProvided ? input.packageId?.trim() || null : existing.packageId;
  const selectedPackage = nextPackageId ? await findRegistrationPackage(nextPackageId) : null;

  if (packageIdWasProvided && nextPackageId && !selectedPackage) {
    return { ok: false as const, error: "Selected package was not found." };
  }

  const nextPackageAudience = selectedPackage?.audience ?? (existing.packageAudience as PackageAudience | null);
  const nextAssignedRole: AppRole =
    nextPackageAudience === "AGENCY"
      ? "ADMIN"
      : nextPackageAudience === "FREELANCER"
        ? "FREELANCER"
        : ((existing.assignedRole as AppRole | null) ?? existing.role);
  const nextPackageStatus =
    input.packageStatus ??
    ((existing.packageStatus as PackageStatus | null) ??
      (nextPackageId ? "ACTIVE" : null));

  let nextPackageExpiresAt =
    input.packageExpiresAt !== undefined
      ? input.packageExpiresAt
        ? new Date(input.packageExpiresAt)
        : null
      : existing.packageExpiresAt;

  if (nextPackageStatus === "EXPIRED") {
    nextPackageExpiresAt = new Date();
  } else if (nextPackageStatus === "ACTIVE" && selectedPackage) {
    const expiryIsMissingOrPast =
      !nextPackageExpiresAt ||
      Number.isNaN(nextPackageExpiresAt.getTime()) ||
      nextPackageExpiresAt.getTime() <= Date.now() ||
      (packageIdWasProvided && nextPackageId !== existing.packageId);
    if (expiryIsMissingOrPast) {
      nextPackageExpiresAt = new Date(Date.now() + selectedPackage.durationDays * 24 * 60 * 60 * 1000);
    }
  }

  const nextTenantId =
    nextPackageAudience === "AGENCY"
      ? resolveAgencyTenantId(existing)
      : existing.tenantId || DEFAULT_TENANT_ID;

  const updated = await prisma.appAuthUser.update({
    where: { id: existing.id },
    data: {
      role: dbRoleMap[nextAssignedRole],
      assignedRole: dbRoleMap[nextAssignedRole],
      tenantId: nextTenantId,
      packageId: nextPackageId,
      packageName: selectedPackage?.name ?? existing.packageName,
      packageAudience: nextPackageAudience ? dbAudienceMap[nextPackageAudience] : null,
      packageStatus: nextPackageStatus ? dbStatusMap[nextPackageStatus] : null,
      packageExpiresAt: nextPackageExpiresAt,
      workspaceMode: nextPackageAudience ? dbWorkspaceMap[nextPackageAudience] : null,
      permissions: Array.from(new Set([...(existing.permissions ?? []), nextAssignedRole.toLowerCase()])),
      createdByUserId: input.updatedByUserId ?? existing.createdByUserId,
    },
  });

  if (nextPackageAudience === "AGENCY" && updated.tenantId) {
    await ensureAgencyTenantStores({
      tenantId: updated.tenantId,
      displayName: updated.displayName,
      phone: updated.phone ?? "",
      email: updated.email,
    });
  }

  invalidateManagedUsersCache();
  return {
    ok: true as const,
    user: fromDbUser(updated).managed,
  };
}

export async function deleteManagedAuthUser(input: { userId: string; deletedByUserId?: string | null }) {
  await ensureBootstrapped();

  const existing = await prisma.appAuthUser.findUnique({ where: { id: input.userId } });
  if (!existing) {
    return { ok: false as const, error: "User not found." };
  }

  if (existing.id === SUPER_ADMIN_USER_ID || existing.role === "SUPER_ADMIN") {
    return { ok: false as const, error: "Super admin cannot be deleted from this panel." };
  }

  if (existing.isSeeded) {
    return { ok: false as const, error: "Seeded system accounts cannot be deleted from this panel." };
  }

  await prisma.$transaction([
    prisma.appFreelancerService.deleteMany({ where: { ownerId: existing.id } }),
    prisma.appAuthChallenge.deleteMany({ where: { userId: existing.id } }),
    prisma.appPasswordResetToken.deleteMany({ where: { userId: existing.id } }),
    prisma.appFreelancerWorkspace.deleteMany({ where: { userId: existing.id } }),
    prisma.appAuthUser.delete({ where: { id: existing.id } }),
  ]);

  invalidateManagedUsersCache();
  return { ok: true as const, deletedUserId: existing.id };
}

export async function ensureAuthStoreReady() {
  await ensureBootstrapped();
}

export async function createInternalUser(input: CreateInternalUserInput, options?: { transaction?: Prisma.TransactionClient; skipBootstrap?: boolean }) {
  if (!options?.skipBootstrap) await ensureBootstrapped();
  const database = options?.transaction ?? prisma;
  let role = String(input.role ?? "").trim().toUpperCase() as AppRole;
  const displayName = input.displayName.trim();
  const email = input.email.trim().toLowerCase();
  const normalizedPhone = input.phone?.trim() ? normalizePhone(input.phone) : "";
  const password = input.password.trim();
  const requestedPackageId = input.packageId?.trim() || null;
  const selectedPackage = requestedPackageId ? await findRegistrationPackage(requestedPackageId) : null;

  if (!["SUPER_ADMIN", "ADMIN", "MANAGER", "SALES_AGENT", "FREELANCER"].includes(role)) return { ok: false as const, error: "Choose a valid internal role." };
  if (role === "SUPER_ADMIN") return { ok: false as const, error: "Super admin is locked to the owner identity and cannot be created from this panel." };
  if (!displayName || !email || !password) return { ok: false as const, error: "Display name, email, and password are required." };
  if (!email.includes("@")) return { ok: false as const, error: "Enter a valid email address." };
  if (role === "MANAGER" && !/^\d{6}$/.test(password)) return { ok: false as const, error: "Manager PIN must be exactly 6 digits." };
  if (role !== "MANAGER" && password.length < 8) return { ok: false as const, error: "Password must be at least 8 characters." };
  if (requestedPackageId && !selectedPackage) return { ok: false as const, error: "Selected package was not found." };
  if (selectedPackage?.audience === "AGENCY") {
    role = "ADMIN";
  } else if (selectedPackage?.audience === "FREELANCER") {
    role = "FREELANCER";
  }

  const duplicate = await database.appAuthUser.findFirst({
    where: {
      OR: [
        { email },
        ...(normalizedPhone ? [{ phone: normalizedPhone }, { loginPhoneAliases: { has: normalizedPhone } }] : []),
      ],
    },
  });
  if (duplicate) {
    const emailConflict = duplicate.email?.toLowerCase() === email;
    return {
      ok: false as const,
      code: emailConflict ? "EMAIL_ALREADY_REGISTERED" : "PHONE_ALREADY_REGISTERED",
      field: emailConflict ? "email" : "phone",
      error: emailConflict
        ? "This email is already registered. Sign in to your existing account or use another email."
        : "This phone number is already linked to an account. Use another phone number or sign in to the existing account.",
    };
  }

  const salt = randomBytes(16).toString("hex");
  const nextPackageStatus = selectedPackage ? input.packageStatus ?? "ACTIVE" : null;
  const packageExpiresAt =
    input.packageExpiresAt !== undefined && input.packageExpiresAt
      ? new Date(input.packageExpiresAt)
      : nextPackageStatus === "EXPIRED"
        ? new Date()
        : selectedPackage && nextPackageStatus === "ACTIVE"
          ? new Date(Date.now() + selectedPackage.durationDays * 24 * 60 * 60 * 1000)
          : null;
  const tenantId =
    selectedPackage?.audience === "AGENCY"
      ? input.tenantId?.trim() || makeAgencyTenantId()
      : input.tenantId?.trim() || DEFAULT_TENANT_ID;
  const user = await database.appAuthUser.create({
    data: {
      id: `user-${role.toLowerCase().replace(/_/g, "-")}-${randomBytes(4).toString("hex")}`,
      role: dbRoleMap[role],
      assignedRole: dbRoleMap[role],
      tenantId,
      displayName,
      email,
      phone: normalizedPhone || null,
      loginPhoneAliases: normalizedPhone ? [normalizedPhone] : [],
      packageId: selectedPackage?.id ?? null,
      packageName: selectedPackage?.name ?? null,
      packageAudience: selectedPackage ? dbAudienceMap[selectedPackage.audience] : null,
      packageStatus: nextPackageStatus ? dbStatusMap[nextPackageStatus] : null,
      packageExpiresAt,
      workspaceMode: selectedPackage ? dbWorkspaceMap[selectedPackage.audience] : null,
      passwordSalt: salt,
      passwordHash: hashPassword(password, salt),
      otpCode: DEFAULT_OTP_CODE,
      permissions: [role.toLowerCase()],
      isSeeded: false,
      createdByUserId: input.createdByUserId ?? null,
    },
  });

  if (role === "ADMIN" && user.tenantId) {
    await ensureAgencyTenantStores({
      tenantId: user.tenantId,
      displayName: user.displayName,
      phone: user.phone ?? "",
      email: user.email,
    });
  }

  if (role === "FREELANCER") {
    await ensureFreelancerWorkspace(user.id, {
      userId: user.id,
      displayName: user.displayName,
      email: user.email,
      phone: user.phone ?? "",
    });
  }

  invalidateManagedUsersCache();
  return { ok: true as const, user: fromDbUser(user).managed };
}

export async function getAuthStoreHealth() {
  await ensureBootstrapped();
  const [userCount, activeChallenges, resetTokens] = await Promise.all([
    prisma.appAuthUser.count(),
    prisma.appAuthChallenge.count({ where: { consumedAt: null, expiresAt: { gt: new Date() } } }),
    prisma.appPasswordResetToken.count({ where: { usedAt: null, expiresAt: { gt: new Date() } } }),
  ]);

  return { userCount, activeChallenges, resetTokens, demoCredentials };
}

export async function cleanupAuthUsers(input?: { preserveUserIds?: string[] }) {
  await ensureBootstrapped();
  const preserveUserIds = new Set([SUPER_ADMIN_USER_ID, ...(input?.preserveUserIds ?? [])]);
  type CleanupUser = {
    id: string;
    email: string | null;
    displayName: string;
    phone: string | null;
    isSeeded: boolean;
    createdByUserId: string | null;
    packageId: string | null;
  };
  const users = await prisma.appAuthUser.findMany({
    select: {
      id: true,
      email: true,
      displayName: true,
      phone: true,
      isSeeded: true,
      createdByUserId: true,
      packageId: true,
    },
  });

  const removableUserIds = (users as CleanupUser[])
    .filter((user: CleanupUser) => !preserveUserIds.has(user.id))
    .filter((user: CleanupUser) => {
      const email = user.email?.toLowerCase() ?? "";
      const displayName = user.displayName.toLowerCase();
      return (
        user.isSeeded ||
        email.endsWith("@gigxomi.local") ||
        email.includes("codex") ||
        email.includes("signup-test") ||
        email.includes("agency-signup") ||
        displayName.includes("testing freelancer") ||
        displayName.includes("tunnel test") ||
        displayName.includes("codex ")
      );
    })
    .map((user: CleanupUser) => user.id);

  if (!removableUserIds.length) {
    return { removedUserIds: [] as string[] };
  }

  await prisma.$transaction([
    prisma.appPasswordResetToken.deleteMany({ where: { userId: { in: removableUserIds } } }),
    prisma.appAuthChallenge.deleteMany({ where: { userId: { in: removableUserIds } } }),
    prisma.appFreelancerWorkspace.deleteMany({ where: { userId: { in: removableUserIds } } }),
    prisma.appAuthUser.deleteMany({ where: { id: { in: removableUserIds } } }),
  ]);

  return { removedUserIds: removableUserIds };
}
