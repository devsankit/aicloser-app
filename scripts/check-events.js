require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const events = await prisma.salesReferralEvent.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' },
    include: { referralCode: true, agent: { include: { user: true } } },
  });
  console.log("Recent Referral Events Count:", events.length);
  console.log("Recent Referral Events:", JSON.stringify(events, null, 2));

  const agents = await prisma.salesAgentProfile.findMany({
    include: { user: true, referralCodes: true }
  });
  console.log("Active Agents with Codes:", JSON.stringify(agents.map(a => ({
    name: a.user.displayName,
    agentCode: a.agentCode,
    status: a.status,
    codes: a.referralCodes.map(r => r.code)
  })), null, 2));
}

main().catch(console.error).finally(async () => {
  await prisma.$disconnect();
  await pool.end();
});
