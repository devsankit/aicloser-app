
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: 'postgresql://aicloser_user:AIcloser%4012345@127.0.0.1:5432/aicloser?schema=public'
});

async function main() {
  const res = await pool.query(`
    SELECT id, "phoneNumber", direction, status, "startedAt", "durationSeconds", "deviceId"
    FROM "SalesMobileCall"
    ORDER BY "startedAt" DESC
    LIMIT 20;
  `);
  console.log('CALLS:', JSON.stringify(res.rows, null, 2));

  const countRes = await pool.query('SELECT count(*) FROM "SalesMobileCall";');
  console.log('TOTAL COUNT:', countRes.rows[0].count);

  const todayRes = await pool.query(`
    SELECT count(*), sum("durationSeconds")
    FROM "SalesMobileCall"
    WHERE "startedAt" >= CURRENT_DATE;
  `);
  console.log('TODAY STATS (Postgres CURRENT_DATE):', todayRes.rows[0]);
}

main().catch(console.error).finally(() => pool.end());
