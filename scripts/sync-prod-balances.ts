import { Pool } from 'pg';

const connectionString = 'postgresql://postgres.jhqlrmlqvdatufbuhtsp:082139063266@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true';
const pool = new Pool({ connectionString });

async function main() {
  console.log('--- RECALCULATING ALL FINANCIAL ACCOUNT BALANCES FROM TRUE LEDGER ROWS ---');
  try {
    const res = await pool.query(`
      WITH recalculated AS (
        SELECT 
          fa.id as account_id,
          COALESCE(
            SUM(
              CASE 
                WHEN (LOWER(t.account) = LOWER(fa.name) AND t.type = 'IN') OR 
                     (LOWER(t.category) = LOWER(fa.name) AND t.type = 'OUT') THEN t.amount
                WHEN (LOWER(t.account) = LOWER(fa.name) AND t.type = 'OUT') OR 
                     (LOWER(t.category) = LOWER(fa.name) AND t.type = 'IN') THEN -t.amount
                ELSE 0
              END
            ), 0
          ) as new_balance
        FROM financial_accounts fa
        LEFT JOIN transactions t ON t.tenant_id = fa.tenant_id AND (LOWER(t.account) = LOWER(fa.name) OR LOWER(t.category) = LOWER(fa.name))
        WHERE fa.tenant_id = 'sdm'
        GROUP BY fa.id
      )
      UPDATE financial_accounts fa
      SET balance = r.new_balance
      FROM recalculated r
      WHERE fa.id = r.account_id
      RETURNING fa.name, fa.balance;
    `);
    
    console.log('[PROD] Successfully recalculated balances:', res.rowCount, 'accounts synced.');
    for(let r of res.rows) {
        console.log(`> ${r.name} -> Rp ${r.balance}`);
    }
  } catch(e) {
    console.error('[PROD] Error:', e);
  } finally {
    await pool.end();
  }
}

main();
