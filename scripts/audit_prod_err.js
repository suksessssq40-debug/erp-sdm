const { Client } = require('pg');
require('dotenv').config();

const PROD_DB = "postgresql://postgres.opondzzpzxsfucakqwgz:082139063266@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres";

async function audit() {
    const client = new Client({ connectionString: PROD_DB });
    await client.connect();

    console.log('--- AUDIT PRODUCTION ACCOUNTS ---');
    const accs = await client.query('SELECT id, name, description FROM financial_accounts');
    console.table(accs.rows);

    console.log('\n--- AUDIT RECENT IMPORTS ---');
    const trans = await client.query(`
        SELECT id, date, description, amount, account, account_id 
        FROM transactions 
        WHERE id LIKE 'IMP_BATCH%' 
        ORDER BY created_at DESC 
        LIMIT 20
    `);
    console.table(trans.rows);

    await client.end();
}
audit();
