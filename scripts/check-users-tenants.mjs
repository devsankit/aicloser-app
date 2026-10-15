import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: 'postgresql://aicloser_user:AIcloser%4012345@127.0.0.1:5432/aicloser?schema=public'
});

async function main() {
  const users = await pool.query('SELECT id, email, phone, role, "tenantId", "displayName" FROM "AppAuthUser";');
  console.log('APP_AUTH_USERS:', JSON.stringify(users.rows, null, 2));

  const workspaces = await pool.query('SELECT * FROM "AicloserWorkspace";');
  console.log('WORKSPACES:', JSON.stringify(workspaces.rows, null, 2));
}

main().catch(console.error).finally(() => pool.end());
