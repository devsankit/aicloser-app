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

async function verify() {
  const tables = [
    'SalesLeadAssignment',
    'SalesAgentProfile',
    'SalesMobileCall',
    'SalesLeadTimelineEntry',
    'SalesActivityLog',
    'SalesLeadPoolItem',
    'SalesMobileDevice'
  ];

  console.log('=== MULTI-TENANT BACKFILL VERIFICATION ===');
  for (const t of tables) {
    const total = await pool.query(`SELECT count(*) FROM "${t}"`);
    const nulls = await pool.query(`SELECT count(*) FROM "${t}" WHERE "tenantId" IS NULL`);
    const distinctTenants = await pool.query(`SELECT "tenantId", count(*) as count FROM "${t}" GROUP BY "tenantId"`);
    console.log(`\nTable [${t}]: Total = ${total.rows[0].count}, NULL tenantId = ${nulls.rows[0].count}`);
    console.log(`  Tenant Distribution:`, distinctTenants.rows);
  }
}

verify().finally(() => pool.end());
