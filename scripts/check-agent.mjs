import fs from "node:fs";
import { Pool } from "pg";

const pool = new Pool({ connectionString: "postgresql://aicloser_user:AIcloser%4012345@127.0.0.1:5432/aicloser?schema=public" });

async function run() {
  const users = await pool.query(`SELECT id, email, "displayName", role, "tenantId" FROM "User"`);
  console.log("Users:", users.rows);

  const agents = await pool.query(`SELECT id, "userId", "tenantId", "agentCode", "canClaimLeads", "maxActiveLeads", status, permissions FROM "SalesAgentProfile"`);
  console.log("Agents:", agents.rows);

  const poolItems = await pool.query(`SELECT id, "customerName", "customerPhone", status, "assignedAgentId" FROM "SalesLeadPoolItem" LIMIT 5`);
  console.log("Pool samples:", poolItems.rows);
}

run().catch(console.error).finally(() => pool.end());
