const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

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
const prisma = new PrismaClient({ adapter });

async function main() {
  const sa = await prisma.appAuthUser.findUnique({ where: { id: 'user-super-admin' } });
  console.log('Super Admin in DB:', sa);
  const byPhone = await prisma.appAuthUser.findMany({ where: { phone: { in: ['+910000000000', '+919981807309'] } } });
  console.log('Users with phone +910000000000 or +919981807309:', byPhone.map(u => ({ id: u.id, email: u.email, phone: u.phone, role: u.role })));
}

main().catch(console.error).finally(async () => {
  await prisma.$disconnect();
  await pool.end();
});
