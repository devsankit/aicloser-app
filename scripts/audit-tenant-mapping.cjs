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

async function audit() {
  console.log('=== SALES AGENT PROFILES ===');
  const agents = await prisma.salesAgentProfile.findMany({
    include: {
      user: {
        select: { id: true, displayName: true, email: true, phone: true, role: true, tenantId: true }
      }
    }
  });
  console.log(`Found ${agents.length} agents:`);
  for (const a of agents) {
    console.log(`- Agent id: ${a.id}, code: ${a.agentCode}, userId: ${a.userId}, tenantId: ${a.user?.tenantId}, name: ${a.user?.displayName}`);
  }

  console.log('\n=== LEADS TENANT RESOLUTION ===');
  const leads = await prisma.salesLeadAssignment.findMany({
    select: {
      id: true,
      assignedAgentId: true,
      createdById: true,
      customerPhone: true,
      assignedAgent: {
        select: {
          user: {
            select: { tenantId: true }
          }
        }
      },
      createdBy: {
        select: { tenantId: true }
      }
    }
  });

  const tenantLeadCounts = {};
  let unresolvedCount = 0;
  for (const l of leads) {
    const t = l.assignedAgent?.user?.tenantId || l.createdBy?.tenantId || 'UNRESOLVED';
    if (t === 'UNRESOLVED') unresolvedCount++;
    tenantLeadCounts[t] = (tenantLeadCounts[t] || 0) + 1;
  }
  console.log('Lead Tenant Counts:', tenantLeadCounts);
  console.log('Unresolved Leads:', unresolvedCount);

  console.log('\n=== MOBILE CALLS RESOLUTION ===');
  const calls = await prisma.salesMobileCall.findMany({
    include: {
      agent: { include: { user: { select: { tenantId: true } } } }
    }
  });
  for (const c of calls) {
    console.log(`- Call id: ${c.id}, agentId: ${c.agentId}, tenantId: ${c.agent?.user?.tenantId}, phone: ${c.phoneNumber}`);
  }

  console.log('\n=== TIMELINE ENTRIES SAMPLE ===');
  const timeline = await prisma.salesLeadTimelineEntry.findMany({
    take: 5
  });
  console.log(`Timeline entries (${timeline.length}):`, timeline);

  console.log('\n=== ACTIVITY LOGS SAMPLE ===');
  const logs = await prisma.salesActivityLog.findMany({
    take: 5
  });
  console.log(`Activity logs (${logs.length}):`, logs);

  console.log('\n=== POOL ITEMS SAMPLE ===');
  const poolItems = await prisma.salesLeadPoolItem.findMany({
    take: 5
  });
  console.log(`Pool items (${poolItems.length}):`, poolItems);
}

audit().finally(async () => {
  await prisma.$disconnect();
  await pool.end();
});
