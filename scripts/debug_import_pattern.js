const { Client } = require('pg');
require('dotenv').config();

async function main() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
    });

    await client.connect();

    try {
        console.log('--- TRANSAKSI DENGAN LONG DESCRIPTION (IMPORT SAMPLE) ---');
        const res = await client.query(`
            SELECT id, date, description, amount, account, account_id 
            FROM transactions 
            WHERE description LIKE '716852399549999%'
        `);
        console.table(res.rows);

        console.log('--- RINGKASAN DATA ---');
        console.log('Total ditemukan:', res.rows.length);

    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

main();
