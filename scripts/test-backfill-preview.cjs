const { Client } = require('pg');

async function testBackfill() {
  const client = new Client({
    connectionString: 'postgresql://aicloser_user:AIcloser%4012345@127.0.0.1:5432/aicloser?schema=public',
    ssl: false,
  });

  await client.connect();
  console.log('=== Simulating Tenant Backfill on aicloser Database ===');

  const query = `
    SELECT
      COALESCE(
        u_agent."tenantId",
        u_creator."tenantId",
        'tenant-default'
      ) AS resolved_tenant_id,
      count(*) AS assignment_count
    FROM "SalesLeadAssignment" sla
    LEFT JOIN "SalesAgentProfile" sap ON sap.id = sla."assignedAgentId"
    LEFT JOIN "AppAuthUser" u_agent ON u_agent.id = sap."userId"
    LEFT JOIN "AppAuthUser" u_creator ON u_creator.id = sla."createdById"
    GROUP BY 1
    ORDER BY 2 DESC;
  `;

  const res = await client.query(query);
  console.log('Backfill mapping breakdown for 756 SalesLeadAssignment rows:');
  console.table(res.rows);

  // Check unique phones per tenant
  const phoneDedupeQuery = `
    SELECT
      COALESCE(u_agent."tenantId", u_creator."tenantId", 'tenant-default') AS resolved_tenant_id,
      sla."customerPhone",
      count(*) AS occurrences
    FROM "SalesLeadAssignment" sla
    LEFT JOIN "SalesAgentProfile" sap ON sap.id = sla."assignedAgentId"
    LEFT JOIN "AppAuthUser" u_agent ON u_agent.id = sap."userId"
    LEFT JOIN "AppAuthUser" u_creator ON u_creator.id = sla."createdById"
    WHERE sla."customerPhone" IS NOT NULL AND sla."customerPhone" != ''
    GROUP BY 1, 2
    HAVING count(*) > 1
    ORDER BY count(*) DESC
    LIMIT 10;
  `;

  const dedupeRes = await client.query(phoneDedupeQuery);
  console.log('\nDuplicate phone numbers within the SAME tenant (if any):');
  console.table(dedupeRes.rows);

  await client.end();
}

testBackfill().catch(console.error);
