
const { Client } = require('pg');

const connectionString = 'postgresql://postgres.opondzzpzxsfucakqwgz:082139063266@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres';

async function checkAttendance() {
  const client = new Client({ connectionString });
  console.log("Investigating Missing Attendance Data...");
  
  try {
    await client.connect();
    
    // 1. Cek Total Data Absensi per Tanggal (Januari 2026)
    // Kita kelompokkan berdasarkan tanggal untuk melihat apakah ada tanggal yang kosong total (0) atau berkurang drastis
    const res = await client.query(`
      SELECT 
        date, 
        COUNT(*) as total_absen 
      FROM attendance 
      WHERE date LIKE '%Januari 2026' OR date LIKE '%January 2026'
      GROUP BY date 
      ORDER BY date ASC
    `);
    
    console.log("--- REKAP ABSENSI JANUARI 2026 ---");
    res.rows.forEach(r => {
        console.log(`Tanggal: ${r.date} | Total: ${r.total_absen}`);
    });

    // 2. Cek apakah ada data 'Unassigned' atau Null Tenant (Siapa tau nyasar jadi NULL tenant_id nya)
    const orphans = await client.query(`
        SELECT COUNT(*) as count 
        FROM attendance 
        WHERE tenant_id IS NULL OR tenant_id = ''
    `);
    console.log(`\nData Absensi Tanpa Tenant (Nyasar?): ${orphans.rows[0].count}`);

    // 3. Cek spesifik tanggal yang disebut hilang (5, 9, 12)
    // Format tanggal di DB mungkin 'Senin, 5 Januari 2026' atau 'Monday, 5 January 2026'
    // Kita cari dengan pola LIKE '%5 Januari%' dll.
    const specificCheck = await client.query(`
        SELECT id, user_id, date, tenant_id FROM attendance 
        WHERE 
            date LIKE '%5 Januari 2026%' OR 
            date LIKE '%9 Januari 2026%' OR 
            date LIKE '%12 Januari 2026%'
    `);
    console.log("\n--- CEK SPESIFIK TANGGAL (5, 9, 12) ---");
    if (specificCheck.rowCount === 0) {
        console.log("HASIL: Data MEMANG TIDAK DITEMUKAN untuk tanggal tersebut.");
    } else {
        console.log(`HASIL: Ditemukan ${specificCheck.rowCount} data!`);
        specificCheck.rows.forEach(r => console.log(JSON.stringify(r)));
    }

  } catch(e) { 
    console.error("Error:", e.message); 
  } finally { 
    await client.end(); 
  }
}

checkAttendance();
