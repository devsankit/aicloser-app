import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: 'postgresql://aicloser_user:AIcloser%4012345@127.0.0.1:5432/aicloser?schema=public'
});

async function main() {
  const res = await pool.query('SELECT * FROM upi_payment_settings;');
  console.log('UPI_PAYMENT_SETTINGS:', JSON.stringify(res.rows, null, 2));

  const links = await pool.query('SELECT count(*) FROM upi_payment_links;');
  console.log('UPI_PAYMENT_LINKS_COUNT:', links.rows[0].count);
}

main().catch(console.error).finally(() => pool.end());
