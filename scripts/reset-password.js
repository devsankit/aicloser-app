const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const { scryptSync, randomBytes } = require('crypto');

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
console.log("Connecting to database host:", new URL(directUrl).hostname);
const pool = new Pool(buildPoolConfig(directUrl));
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function hashPassword(password, salt) {
  return scryptSync(password, salt, 64).toString('hex');
}

async function main() {
  console.log('--- ALL USERS IN DB ---');
  const allUsers = await prisma.appAuthUser.findMany({
    select: { id: true, displayName: true, email: true, phone: true, role: true, loginPhoneAliases: true }
  });
  console.log(JSON.stringify(allUsers, null, 2));

  const newPassword = 'Ankit@1143';

  // Find Super Admin and any Ankit Rathore accounts
  const targetUsers = allUsers.filter(u => 
    u.role === 'SUPER_ADMIN' ||
    (u.email && u.email.toLowerCase().includes('ankitrathore')) ||
    (u.displayName && u.displayName.toLowerCase().includes('ankit')) ||
    (u.phone && u.phone.includes('9981807309'))
  );

  console.log('\n--- TARGET USERS TO RESET PASSWORD TO: ' + newPassword + ' ---');
  console.log(targetUsers.map(u => ({ id: u.id, email: u.email, phone: u.phone, role: u.role, displayName: u.displayName })));

  for (const user of targetUsers) {
    const salt = randomBytes(16).toString('hex');
    const hash = hashPassword(newPassword, salt);
    await prisma.appAuthUser.update({
      where: { id: user.id },
      data: {
        passwordSalt: salt,
        passwordHash: hash
      }
    });
    console.log('Successfully updated password for user:', user.id, user.email || user.phone);
  }

  // Also check if super admin exists
  const superAdmin = await prisma.appAuthUser.findFirst({
    where: { role: 'SUPER_ADMIN' }
  });
  if (!superAdmin) {
    console.log('No super admin found, creating default super admin...');
    const salt = randomBytes(16).toString('hex');
    const hash = hashPassword(newPassword, salt);
    await prisma.appAuthUser.create({
      data: {
        id: 'user-super-admin',
        role: 'SUPER_ADMIN',
        assignedRole: 'SUPER_ADMIN',
        displayName: 'Ankit Rathore',
        email: 'hello.ankitrathore@gmail.com',
        phone: '+919981807309',
        passwordSalt: salt,
        passwordHash: hash,
        otpCode: '904290',
        permissions: ['super_admin', 'admin', 'manager', 'sales_agent'],
        isSeeded: false,
        tenantId: 'tenant-gigxomi'
      }
    });
    console.log('Created Super Admin user-super-admin with password Ankit@1143');
  }
}

main().catch(console.error).finally(async () => {
  await prisma.$disconnect();
  await pool.end();
});
