const { Client } = require('pg');
require('dotenv').config();

const PROD_DB = "postgresql://postgres.opondzzpzxsfucakqwgz:082139063266@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres";

async function rollback() {
    const client = new Client({ connectionString: PROD_DB });
    await client.connect();

    try {
        console.log('--- DRY RUN: ROLLBACK IMPORT ---');
        const res = await client.query("SELECT id, description, amount FROM transactions WHERE id LIKE 'IMP_BATCH%'");
        console.log(`Ditemukan ${res.rows.length} transaksi untuk dihapus.`);

        const res2 = await client.query("SELECT id, name FROM chart_of_accounts WHERE id LIKE 'coa_%' AND created_at > CURRENT_DATE - INTERVAL '1 day'");
        console.log(`Ditemukan ${res2.rows.length} akun COA baru untuk dihapus.`);

        console.log('--- RENCANA PEMULIHAN ---');
        console.log('1. Menghapus transaksi impor hari ini.');
        console.log('2. Menghapus akun COA otomatis hari ini.');
        console.log('3. Mengembalikan saldo bank ke kondisi semula.');

    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}
rollback();
