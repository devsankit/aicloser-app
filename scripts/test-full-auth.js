const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const Module = require('module');
const origRequire = Module.prototype.require;
Module.prototype.require = function(id) {
  if (id === 'server-only') return {};
  return origRequire.apply(this, arguments);
};

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
const prisma = new PrismaClient({ adapter, log: ['error', 'warn'] });

async function main() {
  const store = require('../src/lib/auth/store.ts');
  console.log('1. Calling findUserByIdentifier...');
  const resolved = await store.findUserByIdentifier('hello.ankitrathore@gmail.com');
  console.log('Resolved user:', resolved);

  console.log('2. Calling authenticatePassword...');
  const authUser = await store.authenticatePassword('hello.ankitrathore@gmail.com', 'Ankit@1143');
  console.log('Authenticated user:', authUser);
}

main().catch(err => {
  console.error('FAILED IN TEST:');
  console.error(err);
}).finally(async () => {
  await prisma.$disconnect();
  await pool.end();
});
