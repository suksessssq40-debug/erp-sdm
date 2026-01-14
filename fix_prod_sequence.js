
const { Client } = require('pg');

// PRODUKSI DB
const connectionString = 'postgresql://postgres.opondzzpzxsfucakqwgz:082139063266@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres';

async function fixSequence() {
  const client = new Client({ connectionString });
  console.log("Connecting to Production DB to fix sequence...");
  
  try {
    await client.connect();
    
    // 1. Reset Settings ID Sequence
    // Ini memaksa penghitung ID otomatis (Auto Increment) untuk loncat ke angka tertinggi yang ada + 1
    // Sehingga tidak akan mencoba memakai ID yang sudah terpakai (Unik Constraint Error)
    const res = await client.query(`SELECT setval(pg_get_serial_sequence('settings', 'id'), COALESCE(MAX(id), 1) + 1, false) FROM settings;`);
    
    console.log("✅ Sequence 'settings_id_seq' FIXED. Next ID Value:", res.rows[0].setval);

  } catch(e) { 
    console.error("❌ Failed to fix sequence:", e.message); 
  } finally { 
    await client.end(); 
  }
}

fixSequence();
