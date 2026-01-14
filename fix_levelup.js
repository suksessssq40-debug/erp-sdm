
const { Client } = require('pg');

const connectionString = 'postgresql://postgres.opondzzpzxsfucakqwgz:082139063266@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres';

async function fixLevelUpTimestamp() {
  const client = new Client({ connectionString });
  console.log("Fixing Level Up Timestamp...");
  
  try {
    await client.connect();

    // Target ID: hz7gu4fnk (From previous debug)
    console.log("Updating record hz7gu4fnk...");
    
    // Set created_at to 2026-01-14 17:17:00
    await client.query(`
        UPDATE attendance 
        SET created_at = '2026-01-14 17:17:00' 
        WHERE id = 'hz7gu4fnk'
    `);
    
    console.log("✅ Fixed. User should now see 'Check Out'.");

  } catch(e) { 
    console.error("Error:", e.message); 
  } finally { 
    await client.end(); 
  }
}

fixLevelUpTimestamp();
