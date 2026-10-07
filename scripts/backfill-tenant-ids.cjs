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

async function backfill() {
  console.log('--- STARTING MULTI-TENANT BACKFILL ON AICLOSER DATABASE ---');

  // 1. Backfill SalesAgentProfile
  console.log('\n[1/8] Backfilling SalesAgentProfile...');
  const agents = await prisma.salesAgentProfile.findMany({
    include: { user: { select: { id: true, tenantId: true } } }
  });
  let agentUpdated = 0;
  for (const agent of agents) {
    const tenantId = agent.user?.tenantId || 'tenant-gigxomi';
    if (agent.tenantId !== tenantId) {
      await prisma.salesAgentProfile.update({
        where: { id: agent.id },
        data: { tenantId }
      });
      agentUpdated++;
    }
  }
  console.log(`Updated ${agentUpdated} / ${agents.length} SalesAgentProfile records.`);

  // 2. Backfill SalesLeadAssignment
  console.log('\n[2/8] Backfilling SalesLeadAssignment...');
  const leads = await prisma.salesLeadAssignment.findMany({
    select: {
      id: true,
      tenantId: true,
      assignedAgentId: true,
      createdById: true,
      assignedAgent: { select: { tenantId: true, user: { select: { tenantId: true } } } },
      createdBy: { select: { tenantId: true } }
    }
  });
  let leadsUpdated = 0;
  for (const lead of leads) {
    const tenantId =
      lead.assignedAgent?.tenantId ||
      lead.assignedAgent?.user?.tenantId ||
      lead.createdBy?.tenantId ||
      'tenant-gigxomi';
    if (lead.tenantId !== tenantId) {
      await prisma.salesLeadAssignment.update({
        where: { id: lead.id },
        data: { tenantId }
      });
      leadsUpdated++;
    }
  }
  console.log(`Updated ${leadsUpdated} / ${leads.length} SalesLeadAssignment records.`);

  // 3. Backfill SalesMobileCall
  console.log('\n[3/8] Backfilling SalesMobileCall...');
  const calls = await prisma.salesMobileCall.findMany({
    select: {
      id: true,
      tenantId: true,
      assignment: { select: { tenantId: true } },
      agent: { select: { tenantId: true } }
    }
  });
  let callsUpdated = 0;
  for (const call of calls) {
    const tenantId = call.assignment?.tenantId || call.agent?.tenantId || 'tenant-gigxomi';
    if (call.tenantId !== tenantId) {
      await prisma.salesMobileCall.update({
        where: { id: call.id },
        data: { tenantId }
      });
      callsUpdated++;
    }
  }
  console.log(`Updated ${callsUpdated} / ${calls.length} SalesMobileCall records.`);

  // 4. Backfill SalesLeadTimelineEntry
  console.log('\n[4/8] Backfilling SalesLeadTimelineEntry...');
  const timelineEntries = await prisma.salesLeadTimelineEntry.findMany({
    select: { id: true, tenantId: true, leadId: true, userId: true, agentId: true }
  });
  let timelineUpdated = 0;
  for (const entry of timelineEntries) {
    let tenantId = null;
    if (entry.userId) {
      const user = await prisma.appAuthUser.findUnique({ where: { id: entry.userId }, select: { tenantId: true } });
      tenantId = user?.tenantId;
    }
    if (!tenantId && entry.agentId) {
      const agent = await prisma.salesAgentProfile.findUnique({ where: { id: entry.agentId }, select: { tenantId: true } });
      tenantId = agent?.tenantId;
    }
    if (!tenantId && entry.leadId) {
      const lead = await prisma.salesLeadAssignment.findUnique({ where: { id: entry.leadId }, select: { tenantId: true } });
      tenantId = lead?.tenantId;
    }
    tenantId = tenantId || 'tenant-gigxomi';
    if (entry.tenantId !== tenantId) {
      await prisma.salesLeadTimelineEntry.update({
        where: { id: entry.id },
        data: { tenantId }
      });
      timelineUpdated++;
    }
  }
  console.log(`Updated ${timelineUpdated} / ${timelineEntries.length} SalesLeadTimelineEntry records.`);

  // 5. Backfill SalesActivityLog
  console.log('\n[5/8] Backfilling SalesActivityLog...');
  const logs = await prisma.salesActivityLog.findMany({
    select: { id: true, tenantId: true, assignmentId: true, actorUserId: true }
  });
  let logsUpdated = 0;
  for (const log of logs) {
    let tenantId = null;
    if (log.assignmentId) {
      const lead = await prisma.salesLeadAssignment.findUnique({ where: { id: log.assignmentId }, select: { tenantId: true } });
      tenantId = lead?.tenantId;
    }
    if (!tenantId && log.actorUserId) {
      const user = await prisma.appAuthUser.findUnique({ where: { id: log.actorUserId }, select: { tenantId: true } });
      tenantId = user?.tenantId;
    }
    tenantId = tenantId || 'tenant-gigxomi';
    if (log.tenantId !== tenantId) {
      await prisma.salesActivityLog.update({
        where: { id: log.id },
        data: { tenantId }
      });
      logsUpdated++;
    }
  }
  console.log(`Updated ${logsUpdated} / ${logs.length} SalesActivityLog records.`);

  // 6. Backfill SalesLeadPoolItem
  console.log('\n[6/8] Backfilling SalesLeadPoolItem...');
  const poolItems = await prisma.salesLeadPoolItem.findMany({
    select: { id: true, tenantId: true, assignedAgentId: true, claimedByAgentId: true }
  });
  let poolUpdated = 0;
  for (const item of poolItems) {
    let tenantId = null;
    const agentId = item.assignedAgentId || item.claimedByAgentId;
    if (agentId) {
      const agent = await prisma.salesAgentProfile.findUnique({ where: { id: agentId }, select: { tenantId: true } });
      tenantId = agent?.tenantId;
    }
    tenantId = tenantId || 'tenant-gigxomi';
    if (item.tenantId !== tenantId) {
      await prisma.salesLeadPoolItem.update({
        where: { id: item.id },
        data: { tenantId }
      });
      poolUpdated++;
    }
  }
  console.log(`Updated ${poolUpdated} / ${poolItems.length} SalesLeadPoolItem records.`);

  // 7. Backfill SalesMobileDevice
  console.log('\n[7/8] Backfilling SalesMobileDevice...');
  const devices = await prisma.salesMobileDevice.findMany({
    select: { id: true, tenantId: true, agentId: true }
  });
  let devicesUpdated = 0;
  for (const dev of devices) {
    let tenantId = null;
    if (dev.agentId) {
      const agent = await prisma.salesAgentProfile.findUnique({ where: { id: dev.agentId }, select: { tenantId: true } });
      tenantId = agent?.tenantId;
    }
    tenantId = tenantId || 'tenant-gigxomi';
    if (dev.tenantId !== tenantId) {
      await prisma.salesMobileDevice.update({
        where: { id: dev.id },
        data: { tenantId }
      });
      devicesUpdated++;
    }
  }
  console.log(`Updated ${devicesUpdated} / ${devices.length} SalesMobileDevice records.`);

  // 8. Backfill Referral Codes, Goals, Rewards, Settings
  console.log('\n[8/8] Backfilling Referral Codes, Goals, Rewards, Settings...');
  const refCodes = await prisma.salesReferralCode.findMany({ select: { id: true, agentId: true } });
  for (const rc of refCodes) {
    const agent = await prisma.salesAgentProfile.findUnique({ where: { id: rc.agentId }, select: { tenantId: true } });
    await prisma.salesReferralCode.update({ where: { id: rc.id }, data: { tenantId: agent?.tenantId || 'tenant-gigxomi' } });
  }

  await prisma.salesSettings.updateMany({ where: { tenantId: null }, data: { tenantId: 'tenant-gigxomi' } });
  await prisma.salesCommissionRule.updateMany({ where: { tenantId: null }, data: { tenantId: 'tenant-gigxomi' } });
  await prisma.salesGoal.updateMany({ where: { tenantId: null }, data: { tenantId: 'tenant-gigxomi' } });
  await prisma.salesReward.updateMany({ where: { tenantId: null }, data: { tenantId: 'tenant-gigxomi' } });
  await prisma.salesAnnouncement.updateMany({ where: { tenantId: null }, data: { tenantId: 'tenant-gigxomi' } });

  console.log('\n✅ Multi-tenant backfill complete!');
}

backfill()
  .catch(err => {
    console.error('❌ Backfill error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
