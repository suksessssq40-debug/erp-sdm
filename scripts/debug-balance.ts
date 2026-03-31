import { Pool } from 'pg';
import 'dotenv/config';

const connectionString = 'postgresql://postgres.jhqlrmlqvdatufbuhtsp:082139063266@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true';
const pool = new Pool({ connectionString });

async function main() {
  const tenantId = 'sdm'; 
  const query = `
    SELECT date, type, amount, account, category, description 
    FROM transactions 
    WHERE tenant_id = $1 
    AND (LOWER(account) LIKE '%110003%' OR LOWER(category) LIKE '%110003%')
    ORDER BY date ASC;
  `;
  try {
    const res = await pool.query(query, [tenantId]);
    console.log("Found transactions:", res.rowCount);
    let totalDebit = 0;
    let totalCredit = 0;
    
    for (const r of res.rows) {
      console.log(`${r.date.toISOString().split('T')[0]} | ${r.type} | Rp ${r.amount} | ACC: ${r.account} | CAT: ${r.category} | DESC: ${r.description}`);
      let amt = Number(r.amount);
      if (r.type === 'IN' && r.account.includes('110003')) totalDebit += amt;
      else if (r.type === 'OUT' && r.category.includes('110003')) totalDebit += amt;
      else totalCredit += amt;
    }
    console.log("TOTAL DEBIT: ", totalDebit);
    console.log("TOTAL CREDIT: ", totalCredit);
    console.log("NET SALDO LEDGER: ", totalDebit - totalCredit);
    
    const res2 = await pool.query(`SELECT balance FROM financial_accounts WHERE name LIKE '%110003%' AND tenant_id = $1`, [tenantId]);
    console.log("ACTUAL DB BALANCE:", res2.rows[0]?.balance);
  } catch(e) {
    console.error(e);
  } finally {
    await pool.end();
  }
}

main();
