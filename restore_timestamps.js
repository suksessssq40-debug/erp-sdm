
const { Client } = require('pg');

const connectionString = 'postgresql://postgres.opondzzpzxsfucakqwgz:082139063266@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres';

async function restoreTimestamps() {
  const client = new Client({ connectionString });
  console.log("RESTORASI TIMESTAMP YANG NULL (CRITICAL)...");
  
  try {
    await client.connect();

    // 1. Restore Tanggal 9 Januari (Set ke jam 08 pagi biar urutannya rapi)
    const res9 = await client.query(`
        UPDATE attendance 
        SET created_at = '2026-01-09 08:00:00' 
        WHERE (date = 'Jumat, 9 Januari 2026') AND (created_at IS NULL)
    `);
    console.log(`✅ Restore 9 Januari: ${res9.rowCount} data berhasil dipulihkan timestamp-nya.`);

    // 2. Restore Tanggal 12 Januari (Set ke jam 08 pagi)
    const res12 = await client.query(`
        UPDATE attendance 
        SET created_at = '2026-01-12 08:00:00' 
        WHERE (date = 'Senin, 12 Januari 2026') AND (created_at IS NULL)
    `);
    console.log(`✅ Restore 12 Januari: ${res12.rowCount} data berhasil dipulihkan timestamp-nya.`);

    // 3. Restore Tanggal 5 Januari (Set ke jam 08 pagi)
    const res5 = await client.query(`
        UPDATE attendance 
        SET created_at = '2026-01-05 08:00:00' 
        WHERE (date = 'Senin, 5 Januari 2026') AND (created_at IS NULL)
    `);
    console.log(`✅ Restore 5 Januari: ${res5.rowCount} data berhasil dipulihkan timestamp-nya.`);
    
    // 4. Restore Tanggal 10 Januari (Set ke jam 08 pagi) - Jaga jaga
    const res10 = await client.query(`
        UPDATE attendance 
        SET created_at = '2026-01-10 08:00:00' 
        WHERE (date = 'Sabtu, 10 Januari 2026') AND (created_at IS NULL)
    `);
    console.log(`✅ Restore 10 Januari: ${res10.rowCount} data berhasil dipulihkan timestamp-nya.`);

  } catch(e) { 
    console.error("❌ Gagal Restore:", e.message); 
  } finally { 
    await client.end(); 
  }
}

restoreTimestamps();
