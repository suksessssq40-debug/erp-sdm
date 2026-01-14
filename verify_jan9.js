
const { Client } = require('pg');

const connectionString = 'postgresql://postgres.opondzzpzxsfucakqwgz:082139063266@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres';

async function verifyDates() {
  const client = new Client({ connectionString });
  console.log("Verifikasi Ulang Tanggal 9 Januari...");
  
  try {
    await client.connect();

    // 1. Cek Apakah Tanggal 9 Benar-Benar Ada (Apapun Formatnya) yang dibuat tanggal 9
    const check9 = await client.query(`
        SELECT id, user_id, date, created_at 
        FROM attendance 
        WHERE created_at >= '2026-01-09 00:00:00' AND created_at <= '2026-01-09 23:59:59'
    `);

    console.log(`\nTemuan di DB (Created At = 9 Jan): ${check9.rowCount} data`);
    if (check9.rowCount > 0) {
        console.log("Sample Data 9 Jan:");
        check9.rows.forEach(r => console.log(`- ID: ${r.id} | Date String: '${r.date}'`));
        
        // Cek apakah stringnya "Jumat, 9 Januari 2026"?
        const badFormat = check9.rows.filter(r => r.date !== 'Jumat, 9 Januari 2026');
        if (badFormat.length > 0) {
            console.log("❌ Masih ada format SALAH (Bukan 'Jumat, 9 Januari 2026'):");
            console.log(badFormat);
            
            // PAKSA UPDATE LAGI BAGI YANG BANDEL
            console.log("MEMAKSA UPDATE DATA TANGGAL 9...");
            for (const row of badFormat) {
                 await client.query(`UPDATE attendance SET date = 'Jumat, 9 Januari 2026' WHERE id = $1`, [row.id]);
                 console.log(`Fixed ID ${row.id}`);
            }
        } else {
            console.log("✅ Semua format string tanggal 9 SUDAH BENAR ('Jumat, 9 Januari 2026').");
            console.log("Jika di web tidak muncul, kemungkinan masalah SORTING di frontend.");
        }
    } else {
        console.log("⚠️ TIDAK ADA DATA di DB yang dibuat tanggal 9 Januari. Apakah terhapus?");
    }

  } catch(e) { 
    console.error("Error:", e.message); 
  } finally { 
    await client.end(); 
  }
}

verifyDates();
