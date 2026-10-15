import { Pool } from "pg";

const pool = new Pool({
  connectionString: "postgresql://aicloser_user:AIcloser%4012345@127.0.0.1:5432/aicloser?schema=public",
});

async function run() {
  const stats = await pool.query(`
    SELECT 
      count(id) as total,
      count(case when length("e164Phone") > 13 then 1 end) as lid_phones,
      count(case when "fullName" ~ '^\\+[0-9]{13,}' then 1 end) as lid_names,
      count(case when "fullName" ~ '^\\+[0-9]{10,12}' then 1 end) as phone_names,
      count(case when not ("fullName" ~ '^\\+[0-9]') and length("fullName") > 1 then 1 end) as real_names
    FROM "MarketingContact"
  `);
  console.log("MarketingContact Stats:", stats.rows[0]);
}

run().catch(console.error).finally(() => pool.end());
