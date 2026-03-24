import { Pool } from 'pg';
import 'dotenv/config';

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });

async function main() {
    const tenantId = 'sdm';
    console.log('Resetting transactions via SQL for tenant:', tenantId);
    try {
        const res = await pool.query("DELETE FROM transactions WHERE tenant_id = $1", [tenantId]);
        console.log(`Successfully deleted ${res.rowCount} transactions.`);

        const res2 = await pool.query("UPDATE financial_accounts SET balance = 0 WHERE tenant_id = $1", [tenantId]);
        console.log(`Successfully reset balances to 0 for ${res2.rowCount} financial accounts.`);
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}

main();
