
const { Client } = require('pg');

const connectionString = 'postgresql://postgres.opondzzpzxsfucakqwgz:082139063266@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres';

async function fixNullTimestamps() {
  const client = new Client({ connectionString });
  console.log("🚀 FIXING NULL timestamps for Level-Up...");
  
  try {
    await client.connect();
    
    // We target the record found: id='3yec315qj'
    // We set created_at to (Date + TimeIn combination)
    // Date: 'Thu Jan 15 2026', Time: '16:52'
    // Note: This is UTC+7 context usually, but DB expects timestamp.
    
    // Simplest fix: Just allow current Logic to work by giving it a valid recent timestamp.
    // If he clocked in at 16:52 yesterday (Jan 15), that's approx 11 hours ago.
    
    const targetId = '3yec315qj';
    
    // Construct ISO string for '2026-01-15T16:52:00+07:00' -> UTC
    // actually, let's just use raw SQL update with a fixed string slightly in the past
    
    await client.query(`
        UPDATE attendance 
        SET created_at = '2026-01-15 16:52:00+07'
        WHERE id = $1
    `, [targetId]);

    console.log(`✅ Patched Record ${targetId}`);

  } catch(e) { 
    console.error("❌ Fix Error:", e); 
  } finally { 
    await client.end(); 
  }
}

fixNullTimestamps();
