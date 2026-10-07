const { Pool } = require('pg');
const pool = new Pool({ host: '127.0.0.1', port: 5432, database: 'aicloser', user: 'aicloser_user', password: 'AIcloser@12345' });
pool.query('SELECT "tenantId", count(*) FROM "AppConversation" GROUP BY "tenantId" LIMIT 10')
  .then(r => console.log('AppConversation tenants:', r.rows))
  .finally(() => pool.end());
