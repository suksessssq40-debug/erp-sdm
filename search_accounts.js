const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function findTargetAccounts() {
    try {
        console.log("Searching for specific accounts in 'sdm' tenant...");
        const res = await pool.query(`
      SELECT id, code, name, type 
      FROM chart_of_accounts 
      WHERE tenant_id = 'sdm' 
      AND (
        name ILIKE '%Piutang%Level%Up%' OR 
        name ILIKE '%Penjualan%Level%Up%' OR 
        name ILIKE '%Kas%Kecil%' OR 
        name ILIKE '%Mandiri%14843%' OR
        name ILIKE '%Level%Up%'
      )
    `);

        console.log("Matching Accounts:");
        console.table(res.rows);

        const bankRes = await pool.query(`
      SELECT id, name, bank_name 
      FROM financial_accounts 
      WHERE tenant_id = 'sdm'
    `);
        console.log("Financial (Bank) Accounts:");
        console.table(bankRes.rows);

    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
findTargetAccounts();
