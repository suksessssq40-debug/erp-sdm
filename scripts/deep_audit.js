const { Client } = require('pg');
require('dotenv').config();

const PROD_DB = "postgresql://postgres.opondzzpzxsfucakqwgz:082139063266@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres";

async function check() {
    const client = new Client({ connectionString: PROD_DB });
    await client.connect();

    try {
        console.log('--- CHECKING FOR ANY TRANSACTION WITHOUT ACCOUNT_ID ---');
        const res = await client.query("SELECT COUNT(*) FROM transactions WHERE account_id IS NULL");
        console.log('Total transactions with NULL account_id:', res.rows[0].count);

        if (res.rows[0].count > 0) {
            const samples = await client.query("SELECT * FROM transactions WHERE account_id IS NULL LIMIT 10");
            console.table(samples.rows);
        }

        console.log('\n--- CHECKING FOR ACCOUNT NAMES IN TRANSACTIONS THAT DONT EXIST IN FINANCIAL_ACCOUNTS ---');
        const res2 = await client.query(`
            SELECT DISTINCT t.account 
            FROM transactions t 
            LEFT JOIN financial_accounts fa ON t.account_id = fa.id 
            WHERE fa.id IS NULL AND t.account IS NOT NULL
        `);
        console.log('Found account names not linked to financial_accounts:', res2.rows.length);
        console.table(res2.rows);

        console.log('\n--- CHECKING IF ANY FINANCIAL ACCOUNT IS ACTUALLY A COA (Non-Head 1) ---');
        // This is a bit subjective but let's check
        const res3 = await client.query("SELECT name, description FROM financial_accounts");
        console.table(res3.rows);

    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}
check();
