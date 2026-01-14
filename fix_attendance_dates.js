
const { Client } = require('pg');

const connectionString = 'postgresql://postgres.opondzzpzxsfucakqwgz:082139063266@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres';

async function normalizeDates() {
  const client = new Client({ connectionString });
  console.log("Mulai Normalisasi Data Absensi (Inggris -> Indonesia)...");
  
  try {
    await client.connect();

    // Mapping Kamus Hari & Bulan Inggris -> Indonesia
    // Format Asli DB yang salah: 'Mon Jan 05 2026'
    // Target: 'Senin, 5 Januari 2026'
    
    // TANGGAL 5 JAN (Monday)
    console.log("Memperbaiki Tanggal 5 Januari...");
    await client.query(`
        UPDATE attendance 
        SET date = 'Senin, 5 Januari 2026' 
        WHERE date LIKE 'Mon Jan 05 2026%' OR date LIKE '%Jan 5 2026%'
    `);

    // TANGGAL 9 JAN (Friday)
    console.log("Memperbaiki Tanggal 9 Januari...");
    await client.query(`
        UPDATE attendance 
        SET date = 'Jumat, 9 Januari 2026' 
        WHERE date LIKE 'Fri Jan 09 2026%' OR date LIKE '%Jan 9 2026%'
    `);

    // TANGGAL 12 JAN (Monday)
    console.log("Memperbaiki Tanggal 12 Januari...");
    await client.query(`
        UPDATE attendance 
        SET date = 'Senin, 12 Januari 2026' 
        WHERE date LIKE 'Mon Jan 12 2026%' OR date LIKE '%Jan 12 2026%'
    `);
    
    // TANGGAL 10 JAN (Saturday) - Jaga jaga
    console.log("Memperbaiki Tanggal 10 Januari (Jaga-jaga)...");
    await client.query(`
        UPDATE attendance 
        SET date = 'Sabtu, 10 Januari 2026' 
        WHERE date LIKE 'Sat Jan 10 2026%' OR date LIKE '%Jan 10 2026%'
    `);

    console.log("✅ SELESAI. Data tanggal 5, 9, 10, 12 Januari sudah dikonversi ke Format Indonesia.");

  } catch(e) { 
    console.error("Gagal Normalisasi:", e.message); 
  } finally { 
    await client.end(); 
  }
}

normalizeDates();
