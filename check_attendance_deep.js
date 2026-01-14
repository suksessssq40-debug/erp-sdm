
const { Client } = require('pg');

const connectionString = 'postgresql://postgres.opondzzpzxsfucakqwgz:082139063266@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres';

async function deepDiveSearch() {
  const client = new Client({ connectionString });
  console.log("Deep Dive Search (Ignoring Exact String Match)...");
  
  try {
    await client.connect();
    
    // 1. Cek 50 Data Terakhir APAPUN itu isinya, biar kita lihat format tanggalnya
    const sample = await client.query(`SELECT date, created_at FROM attendance ORDER BY created_at DESC LIMIT 20`);
    console.log("Sample Data Terakhir:");
    sample.rows.forEach(r => console.log(`Date String: '${r.date}', Created At: ${r.created_at}`));

    // 2. Cek apakah ada data yang tanggalnya 'created_at' nya jatuh pada tanggal 5, 9, 12, TAPI string 'date' nya salah/beda?
    // Kita filter berdasarkan TIMESTAMP created_at
    const timestampCheck = await client.query(`
        SELECT id, user_id, date, created_at 
        FROM attendance 
        WHERE 
           (created_at >= '2026-01-05 00:00:00' AND created_at <= '2026-01-05 23:59:59') OR
           (created_at >= '2026-01-09 00:00:00' AND created_at <= '2026-01-09 23:59:59') OR
           (created_at >= '2026-01-12 00:00:00' AND created_at <= '2026-01-12 23:59:59')
    `);
    
    console.log(`\n--- CEK BY TIMESTAMP (Created At) ---`);
    console.log(`Ditemukan: ${timestampCheck.rowCount} entries.`);
    timestampCheck.rows.forEach(r => console.log(`ID: ${r.id}, User: ${r.user_id}, DateString: '${r.date}'`));

  } catch(e) { 
    console.error("Error:", e.message); 
  } finally { 
    await client.end(); 
  }
}

deepDiveSearch();
