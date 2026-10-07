const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

const databaseUrl = process.env.DATABASE_URL || 'postgresql://aicloser_user:AIcloser%4012345@127.0.0.1:5432/aicloser?schema=public';
const parsed = new URL(databaseUrl);
const pool = new Pool({
  host: parsed.hostname,
  port: parsed.port ? Number(parsed.port) : 5432,
  database: parsed.pathname.replace(/^\//, '') || 'aicloser',
  user: decodeURIComponent(parsed.username),
  password: decodeURIComponent(parsed.password),
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const models = [
    'salesLeadAssignment',
    'salesAgentProfile',
    'salesMobileCall',
    'salesDeal',
    'salesLeadTimelineEntry',
    'salesActivityLog',
    'salesLeadPoolItem',
    'salesMobileDevice',
    'salesSettings',
    'salesCommissionRule',
    'salesRoundRobinRule',
    'salesEarning',
    'salesPayout',
    'salesReferralCode',
    'salesGoal',
    'salesReward',
    'salesAnnouncement',
    'marketingContact',
    'conversation',
    'appConversation',
    'appAuthUser'
  ];

  for (const m of models) {
    try {
      if (prisma[m]) {
        const count = await prisma[m].count();
        console.log(`${m}: ${count}`);
      } else {
        console.log(`${m}: not found on prisma client`);
      }
    } catch (e) {
      console.log(`${m}: error ${e.message.split('\n')[0]}`);
    }
  }
}

main().finally(async () => {
  await prisma.$disconnect();
  await pool.end();
});
