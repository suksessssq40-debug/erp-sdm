const { Client } = require('pg');
require('dotenv').config();

async function main() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
    });

    await client.connect();

    try {
        console.log('--- MENCARI TRANSAKSI NON-KAS (GENERAL JOURNAL) ---');
        // Cari transaksi yang account_id-nya NULL
        const res = await client.query(`
            SELECT id, date, amount, type, account, category, account_id, coa_id, description
            FROM transactions 
            WHERE account_id IS NULL
            ORDER BY date DESC
        `);

        if (res.rows.length === 0) {
            console.log('Tidak ditemukan transaksi dengan account_id NULL.');
        } else {
            console.table(res.rows);
        }

    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}

main();
