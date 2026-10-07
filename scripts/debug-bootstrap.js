const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const { scryptSync, randomBytes, createHash } = require('crypto');

function decodePrismaPostgresUrl(databaseUrl) {
  if (!databaseUrl || !databaseUrl.startsWith("prisma+postgres://")) {
    return databaseUrl;
  }
  const parsed = new URL(databaseUrl);
  const apiKey = parsed.searchParams.get("api_key")?.trim();
  const encodedPayload = apiKey.includes(".") ? apiKey.split(".")[1] : apiKey;
  const decoded = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
  return decoded.databaseUrl.trim();
}

const directUrl = decodePrismaPostgresUrl(process.env.DATABASE_URL);
const pool = new Pool({ connectionString: directUrl, ssl: { rejectUnauthorized: false } });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter, log: ['query', 'info', 'warn', 'error'] });

const SUPER_ADMIN_USER_ID = "user-super-admin";
const SUPER_ADMIN_DISPLAY_NAME = "Ankit Rathore";
const SUPER_ADMIN_FALLBACK_PHONE = "+910000000000";
const SUPER_ADMIN_LOGIN_EMAIL_LOWER = "hello.ankitrathore@gmail.com";
const SUPER_ADMIN_ALLOWED_OTP_PHONES_NORMALIZED = [];

function hashPassword(password, salt) {
  return scryptSync(password, salt, 64).toString("hex");
}

async function upsertProtectedSuperAdmin() {
  const existing = await prisma.appAuthUser.findUnique({ where: { id: SUPER_ADMIN_USER_ID } });
  const bootstrapPassword = process.env.GXCLOSERS_SUPER_ADMIN_BOOTSTRAP_PASSWORD?.trim();
  const passwordSalt = existing ? existing.passwordSalt : randomBytes(16).toString("hex");
  const passwordHash = existing ? existing.passwordHash : hashPassword("Ankit@1143", passwordSalt);
  const payload = {
    role: "SUPER_ADMIN",
    assignedRole: "SUPER_ADMIN",
    tenantId: null,
    displayName: SUPER_ADMIN_DISPLAY_NAME,
    email: SUPER_ADMIN_LOGIN_EMAIL_LOWER,
    phone: existing?.phone && existing.phone !== "+919981807309" ? existing.phone : "+910000000000",
    loginPhoneAliases: SUPER_ADMIN_ALLOWED_OTP_PHONES_NORMALIZED,
    packageId: null,
    packageName: null,
    packageAudience: null,
    packageStatus: null,
    packageExpiresAt: null,
    workspaceMode: null,
    passwordSalt,
    passwordHash,
    otpCode: "904290",
    permissions: ["super_admin"],
    isSeeded: true,
    createdByUserId: null,
    lastLoginAt: existing?.lastLoginAt ?? null,
    lastOtpSentAt: existing?.lastOtpSentAt ?? null,
  };

  console.log("Existing SA:", existing);
  console.log("Payload:", payload);

  if (existing) {
    const updated = await prisma.appAuthUser.update({
      where: { id: SUPER_ADMIN_USER_ID },
      data: payload,
    });
    console.log("Updated SA successfully:", updated.id);
  }
}

async function main() {
  await upsertProtectedSuperAdmin();

  // Test findUserRecord & authenticatePassword
  const user = await prisma.appAuthUser.findUnique({ where: { id: SUPER_ADMIN_USER_ID } });
  console.log("Found user:", user.email, user.role);

  // Now simulate authenticatePassword:
  const updated = await prisma.appAuthUser.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  console.log("Updated lastLoginAt:", updated.lastLoginAt);
}

main().catch(console.error).finally(async () => {
  await prisma.$disconnect();
  await pool.end();
});
