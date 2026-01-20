
import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL, 
});

async function auditTransactionStatus() {
  console.log("🔍 AUDIT STATUS TRANSAKSI & DAMPAK SALDO\n");
  
  try {
    // 1. Cek Varian Status yang dipakai
    const resStats = await pool.query(`
      SELECT status, type, COUNT(*) as jumlah_data, SUM(amount) as total_nominal 
      FROM transactions 
      GROUP BY status, type
    `);

    console.log("📊 Rekap Data berdasarkan Status:");
    console.table(resStats.rows.map(r => ({
        Status: r.status || 'NULL (Kosong)',
        Tipe: r.type,
        'Jumlah Data': r.jumlah_data,
        'Total Uang': Number(r.total_nominal).toLocaleString('id-ID')
    })));

    // 2. Cek Sampel Data 'Belum Lunas' (jika ada)
    const resSample = await pool.query(`
      SELECT date, description, amount, status, type 
      FROM transactions 
      WHERE status IS NOT NULL AND status != 'PAID'
      LIMIT 5
    `);

    if (resSample.rows.length > 0) {
        console.log("\n⚠️ Contoh Data yang KEMUNGKINAN TIDAK UPDATE SALDO (Tersangka):");
        console.table(resSample.rows.map(r => ({
            Tanggal: r.date,
            Desc: r.description,
            Nominal: Number(r.amount).toLocaleString('id-ID'),
            Status: r.status
        })));
    } else {
        console.log("\n✅ Tidak ditemukan data dengan status selain PAID (Mungkin Finance input statusnya NULL?)");
    }

  } catch (e) {
    console.error("Error Audit:", e);
  } finally {
    await pool.end();
  }
}

auditTransactionStatus();
