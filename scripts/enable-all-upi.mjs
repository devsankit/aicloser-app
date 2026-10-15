import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: 'postgresql://aicloser_user:AIcloser%4012345@127.0.0.1:5432/aicloser?schema=public'
});

async function main() {
  const tenants = [
    'tenant-the-storage-test-1d01dda2',
    'tenant-ai-closer-996ec2f6',
    'tenant-super-admin-b8a96b58',
    'tenant-gigxomi-4f22efa0',
    'tenant-jay-estate-management-01773ec9'
  ];

  for (const tenantId of tenants) {
    const existing = await pool.query('SELECT id FROM upi_payment_settings WHERE "tenantId" = $1;', [tenantId]);
    if (existing.rows.length > 0) {
      await pool.query(`
        UPDATE upi_payment_settings 
        SET enabled = true, "upiId" = '7974063067@ybl', "payeeName" = 'AI Closer', "qrBrandName" = 'AI Closer', "qrAccentColor" = '#ff5a1f'
        WHERE "tenantId" = $1;
      `, [tenantId]);
      console.log(`Updated upi_payment_settings for ${tenantId} to ENABLED with 7974063067@ybl`);
    } else {
      const id = 'cmv_upi_' + Math.random().toString(36).substring(2, 12);
      await pool.query(`
        INSERT INTO upi_payment_settings ("id", "tenantId", "enabled", "upiId", "payeeName", "qrBrandName", "qrAccentColor", "screenshotRequired", "utrEnabled", "autoActivateOnApproval", "durationMultipliers", "createdAt", "updatedAt")
        VALUES ($1, $2, true, '7974063067@ybl', 'AI Closer', 'AI Closer', '#ff5a1f', true, true, false, '{"DAY":0.5,"YEAR":12,"MONTH":1,"durationOperation":"MULTIPLY","quantityOperation":"MULTIPLY","closerCanApprovePayment":true}', NOW(), NOW());
      `, [id, tenantId]);
      console.log(`Inserted upi_payment_settings for ${tenantId} as ENABLED with 7974063067@ybl`);
    }
  }

  const res = await pool.query('SELECT "tenantId", enabled, "upiId", "payeeName" FROM upi_payment_settings;');
  console.log('FINAL UPI SETTINGS:', JSON.stringify(res.rows, null, 2));
}

main().catch(console.error).finally(() => pool.end());
