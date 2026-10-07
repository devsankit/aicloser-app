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

const statements = [
  // SalesSettings
  `ALTER TABLE "SalesSettings" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "SalesSettings_tenantId_key" ON "SalesSettings"("tenantId");`,

  // SalesAgentGroup
  `ALTER TABLE "SalesAgentGroup" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;`,
  `CREATE INDEX IF NOT EXISTS "SalesAgentGroup_tenantId_idx" ON "SalesAgentGroup"("tenantId");`,

  // SalesAgentProfile
  `ALTER TABLE "SalesAgentProfile" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;`,
  `CREATE INDEX IF NOT EXISTS "SalesAgentProfile_tenantId_idx" ON "SalesAgentProfile"("tenantId");`,

  // SalesLeadAssignment
  `ALTER TABLE "SalesLeadAssignment" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;`,
  `CREATE INDEX IF NOT EXISTS "SalesLeadAssignment_tenantId_createdAt_idx" ON "SalesLeadAssignment"("tenantId", "createdAt");`,
  `CREATE INDEX IF NOT EXISTS "SalesLeadAssignment_tenantId_stage_idx" ON "SalesLeadAssignment"("tenantId", "stage");`,
  `CREATE INDEX IF NOT EXISTS "SalesLeadAssignment_tenantId_customerPhone_idx" ON "SalesLeadAssignment"("tenantId", "customerPhone");`,
  `CREATE INDEX IF NOT EXISTS "SalesLeadAssignment_tenantId_conversationId_idx" ON "SalesLeadAssignment"("tenantId", "conversationId");`,

  // SalesLeadPoolItem
  `ALTER TABLE "SalesLeadPoolItem" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;`,
  `CREATE INDEX IF NOT EXISTS "SalesLeadPoolItem_tenantId_status_idx" ON "SalesLeadPoolItem"("tenantId", "status");`,
  `CREATE INDEX IF NOT EXISTS "SalesLeadPoolItem_tenantId_createdAt_idx" ON "SalesLeadPoolItem"("tenantId", "createdAt");`,

  // SalesDeal
  `ALTER TABLE "SalesDeal" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;`,
  `CREATE INDEX IF NOT EXISTS "SalesDeal_tenantId_createdAt_idx" ON "SalesDeal"("tenantId", "createdAt");`,
  `CREATE INDEX IF NOT EXISTS "SalesDeal_tenantId_status_idx" ON "SalesDeal"("tenantId", "status");`,

  // SalesCommissionRule
  `ALTER TABLE "SalesCommissionRule" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;`,
  `CREATE INDEX IF NOT EXISTS "SalesCommissionRule_tenantId_idx" ON "SalesCommissionRule"("tenantId");`,

  // SalesEarning
  `ALTER TABLE "SalesEarning" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;`,
  `CREATE INDEX IF NOT EXISTS "SalesEarning_tenantId_createdAt_idx" ON "SalesEarning"("tenantId", "createdAt");`,

  // SalesPayout
  `ALTER TABLE "SalesPayout" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;`,
  `CREATE INDEX IF NOT EXISTS "SalesPayout_tenantId_createdAt_idx" ON "SalesPayout"("tenantId", "createdAt");`,

  // SalesReferralCode
  `ALTER TABLE "SalesReferralCode" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;`,
  `CREATE INDEX IF NOT EXISTS "SalesReferralCode_tenantId_idx" ON "SalesReferralCode"("tenantId");`,

  // CouponCampaign & CouponRedemption
  `ALTER TABLE "CouponCampaign" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;`,
  `CREATE INDEX IF NOT EXISTS "CouponCampaign_tenantId_idx" ON "CouponCampaign"("tenantId");`,
  `ALTER TABLE "CouponRedemption" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;`,
  `CREATE INDEX IF NOT EXISTS "CouponRedemption_tenantId_idx" ON "CouponRedemption"("tenantId");`,

  // SalesReferralEvent
  `ALTER TABLE "SalesReferralEvent" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;`,
  `CREATE INDEX IF NOT EXISTS "SalesReferralEvent_tenantId_createdAt_idx" ON "SalesReferralEvent"("tenantId", "createdAt");`,

  // SalesGoal & SalesReward
  `ALTER TABLE "SalesGoal" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;`,
  `CREATE INDEX IF NOT EXISTS "SalesGoal_tenantId_idx" ON "SalesGoal"("tenantId");`,
  `ALTER TABLE "SalesReward" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;`,
  `CREATE INDEX IF NOT EXISTS "SalesReward_tenantId_idx" ON "SalesReward"("tenantId");`,

  // SalesAnnouncement & SalesMessageThread
  `ALTER TABLE "SalesAnnouncement" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;`,
  `CREATE INDEX IF NOT EXISTS "SalesAnnouncement_tenantId_idx" ON "SalesAnnouncement"("tenantId");`,
  `ALTER TABLE "SalesMessageThread" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;`,
  `CREATE INDEX IF NOT EXISTS "SalesMessageThread_tenantId_idx" ON "SalesMessageThread"("tenantId");`,

  // SalesActivityLog
  `ALTER TABLE "SalesActivityLog" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;`,
  `CREATE INDEX IF NOT EXISTS "SalesActivityLog_tenantId_createdAt_idx" ON "SalesActivityLog"("tenantId", "createdAt");`,

  // SalesMobileDevice
  `ALTER TABLE "SalesMobileDevice" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;`,
  `CREATE INDEX IF NOT EXISTS "SalesMobileDevice_tenantId_idx" ON "SalesMobileDevice"("tenantId");`,

  // SalesMobileCall
  `ALTER TABLE "SalesMobileCall" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;`,
  `CREATE INDEX IF NOT EXISTS "SalesMobileCall_tenantId_startedAt_idx" ON "SalesMobileCall"("tenantId", "startedAt");`,
  `CREATE INDEX IF NOT EXISTS "SalesMobileCall_tenantId_phoneNumber_idx" ON "SalesMobileCall"("tenantId", "phoneNumber");`,

  // SalesMobileOfflineEvent & SalesMobileLeadPack
  `ALTER TABLE "SalesMobileOfflineEvent" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;`,
  `CREATE INDEX IF NOT EXISTS "SalesMobileOfflineEvent_tenantId_idx" ON "SalesMobileOfflineEvent"("tenantId");`,
  `ALTER TABLE "SalesMobileLeadPack" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;`,
  `CREATE INDEX IF NOT EXISTS "SalesMobileLeadPack_tenantId_idx" ON "SalesMobileLeadPack"("tenantId");`,

  // SalesLeadTimelineEntry
  `ALTER TABLE "SalesLeadTimelineEntry" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;`,
  `CREATE INDEX IF NOT EXISTS "SalesLeadTimelineEntry_tenantId_createdAt_idx" ON "SalesLeadTimelineEntry"("tenantId", "createdAt");`,
  `CREATE INDEX IF NOT EXISTS "SalesLeadTimelineEntry_tenantId_leadId_idx" ON "SalesLeadTimelineEntry"("tenantId", "leadId");`,

  // SalesRoundRobinRule
  `ALTER TABLE "SalesRoundRobinRule" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;`,
  `CREATE INDEX IF NOT EXISTS "SalesRoundRobinRule_tenantId_idx" ON "SalesRoundRobinRule"("tenantId");`,
];

async function runMigration() {
  console.log(`Connecting to ${parsed.hostname}:${parsed.port || 5432}/${parsed.pathname.replace(/^\//, '')}...`);
  const client = await pool.connect();
  try {
    const dbRes = await client.query('SELECT current_database(), current_user;');
    console.log('Connected DB:', dbRes.rows[0]);

    console.log(`\nExecuting ${statements.length} safe additive DDL statements...`);
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      const start = Date.now();
      await client.query(stmt);
      const duration = Date.now() - start;
      console.log(`[${i + 1}/${statements.length}] (${duration}ms) ${stmt.replace(/\s+/g, ' ').slice(0, 75)}...`);
    }

    console.log('\n✅ Safe additive migration completed successfully!');
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
