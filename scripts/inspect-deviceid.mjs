import pg from 'pg';
const pool = new pg.Pool({ connectionString: 'postgresql://aicloser_user:AIcloser%4012345@127.0.0.1:5432/aicloser?schema=public' });
async function run() {
  const res = await pool.query(`
    SELECT id, "contactName", "contactNumber", summary, channel, "externalSourceType"
    FROM "Conversation"
    WHERE "contactNumber" LIKE '%deviceId%' OR "contactName" LIKE '%deviceId%' OR summary LIKE '%deviceId%'
    LIMIT 5;
  `);
  console.log('CONVERSATIONS WITH DEVICEID:', JSON.stringify(res.rows, null, 2));
  await pool.end();
}
run().catch(console.error);
