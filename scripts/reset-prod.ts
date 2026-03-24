import { Pool } from 'pg';

const connectionString = 'postgresql://postgres.jhqlrmlqvdatufbuhtsp:082139063266@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true';
const pool = new Pool({ connectionString });

async function main() {
    const tenantId = 'sdm';
    console.log('--- EXECUTING PRODUCTION DATABASE RESET FOR TENANT:', tenantId, '---');
    try {
        const res = await pool.query("DELETE FROM transactions WHERE tenant_id = $1", [tenantId]);
        console.log(`[PROD] Successfully deleted ${res.rowCount} transactions.`);

        const res2 = await pool.query("UPDATE financial_accounts SET balance = 0 WHERE tenant_id = $1", [tenantId]);
        console.log(`[PROD] Successfully reset balances to 0 for ${res2.rowCount} financial accounts.`);
    } catch (e) {
        console.error('[PROD] Error:', e);
    } finally {
        await pool.end();
    }
}

main();
