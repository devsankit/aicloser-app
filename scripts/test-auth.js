const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const { scryptSync, timingSafeEqual } = require('crypto');

function decodePrismaPostgresUrl(databaseUrl) {
  if (!databaseUrl || !databaseUrl.startsWith("prisma+postgres://")) {
    return databaseUrl;
  }
  const parsed = new URL(databaseUrl);
  const apiKey = parsed.searchParams.get("api_key")?.trim();
  if (!apiKey) throw new Error("Missing api_key");
  const encodedPayload = apiKey.includes(".") ? apiKey.split(".")[1] : apiKey;
  const decoded = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
  return decoded.databaseUrl.trim();
}

function buildPoolConfig(databaseUrl) {
  const parsed = new URL(databaseUrl);
  return {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 5432,
    database: parsed.pathname.replace(/^\//, "") || "postgres",
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    ssl: { rejectUnauthorized: false }
  };
}

const directUrl = decodePrismaPostgresUrl(process.env.DATABASE_URL);
const pool = new Pool(buildPoolConfig(directUrl));
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function hashPassword(password, salt) {
  return scryptSync(password, salt, 64).toString('hex');
}

function safeCompare(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

async function testAuth(identifier, password) {
  const user = await prisma.appAuthUser.findFirst({
    where: {
      OR: [
        { email: identifier },
        { phone: identifier },
        { loginPhoneAliases: { has: identifier } },
        { id: identifier }
      ]
    }
  });
  if (!user) {
    console.log(`[FAIL] User not found for identifier: ${identifier}`);
    return;
  }
  const expectedHash = hashPassword(password, user.passwordSalt);
  const ok = safeCompare(expectedHash, user.passwordHash);
  console.log(`[${ok ? 'SUCCESS' : 'FAIL'}] Auth for ${user.displayName} (${user.email || user.phone}, Role: ${user.role}) with password "${password}" -> ${ok ? 'VALID' : 'INVALID'}`);
}

async function main() {
  await testAuth('hello.ankitrathore@gmail.com', 'Ankit@1143');
  await testAuth('gigxomi@gmail.com', 'Ankit@1143');
  await testAuth('+919981807309', 'Ankit@1143');
  await testAuth('ankit.sales@gmail.com', 'Ankit@1143');
}

main().catch(console.error).finally(async () => {
  await prisma.$disconnect();
  await pool.end();
});
