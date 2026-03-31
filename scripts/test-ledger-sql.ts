import { Pool } from 'pg';
import 'dotenv/config';

const connectionString = 'postgresql://postgres.jhqlrmlqvdatufbuhtsp:082139063266@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true';
const pool = new Pool({ connectionString });

async function main() {
  const accountName = '110003 Kas Kecil PDC';
  const startDate = '2026-02-28';
  const endDate = '2026-03-30';
  const tenantId = 'sdm';

  const startD = new Date(startDate).toISOString();
  const endD = new Date(endDate);
  endD.setUTCHours(23, 59, 59, 999);
  const endIso = endD.toISOString();

  console.log(`Querying between ${startD} and ${endIso}`);

  const transQuery = `
      SELECT id, date, type, amount, account, category, description 
      FROM transactions 
      WHERE tenant_id = $1 
      AND (LOWER(account) = LOWER($2) OR LOWER(category) = LOWER($2))
      AND date >= $3 AND date <= $4
      ORDER BY date ASC, created_at ASC
  `;

  try {
    const res = await pool.query(transQuery, [tenantId, accountName, startD, endIso]);
    console.log("Matched exactly:", res.rowCount);
    for (let r of res.rows) {
        console.log(`${r.date.toISOString()} | ${r.amount} | ${r.description} | ACC: ${r.account} | CAT: ${r.category}`);
    }
  } catch(e) {
    console.error(e);
  } finally {
    pool.end();
  }
}

main();
