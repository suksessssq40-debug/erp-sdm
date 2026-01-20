
import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL, 
});

async function checkOrphanTransactions() {
  console.log("🔍 CEK TRANSAKSI YATIM PIATU (TANPA ACCOUNT ID)\n");
  
  try {
    const res = await pool.query(`
      SELECT 
        date, 
        description, 
        amount, 
        status, 
        account,      -- Nama Akun (String)
        account_id    -- Link ID (Foreign Key) - INI YG PENTING
      FROM transactions 
      WHERE description ILIKE '%Maya%' OR status != 'PAID'
    `);

    if (res.rows.length > 0) {
        console.table(res.rows.map(r => ({
            Desc: r.description,
            Nominal: Number(r.amount).toLocaleString('id-ID'),
            Status: r.status,
            'Nama Akun (Text)': r.account,
            'Account ID (Link)': r.account_id ? r.account_id : '❌ NULL (GAPUNYA RUMAH)'
        })));
    } else {
        console.log("Tidak ditemukan transaksi mencurigakan.");
    }

  } catch (e) {
    console.error("Error Audit:", e);
  } finally {
    await pool.end();
  }
}

checkOrphanTransactions();
