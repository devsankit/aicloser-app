const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const { scryptSync, randomBytes } = require('crypto');

function decodePrismaPostgresUrl(databaseUrl) {
  if (!databaseUrl || !databaseUrl.startsWith("prisma+postgres://")) return databaseUrl;
  const parsed = new URL(databaseUrl);
  const apiKey = parsed.searchParams.get("api_key")?.trim();
  const encodedPayload = apiKey.includes(".") ? apiKey.split(".")[1] : apiKey;
  const decoded = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
  return decoded.databaseUrl.trim();
}

const directUrl = decodePrismaPostgresUrl(process.env.DATABASE_URL);
const pool = new Pool({ connectionString: directUrl, ssl: { rejectUnauthorized: false } });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function hashPassword(password, salt) {
  return scryptSync(password, salt, 64).toString("hex");
}

async function main() {
  const newPassword = 'Ankit@1143';
  const targetIds = ['user-super-admin', 'user-admin-8171085f', 'user-sales-agent-8355d27e'];

  for (const id of targetIds) {
    const salt = randomBytes(16).toString("hex");
    const hash = hashPassword(newPassword, salt);
    await prisma.appAuthUser.update({
      where: { id },
      data: {
        passwordSalt: salt,
        passwordHash: hash
      }
    });
    console.log('Updated user:', id, 'with password:', newPassword);
  }
}

main().catch(console.error).finally(async () => {
  await prisma.$disconnect();
  await pool.end();
});
