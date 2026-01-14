
const { Client } = require('pg');

const connectionString = 'postgresql://postgres.opondzzpzxsfucakqwgz:082139063266@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres';

async function checkOrphans() {
  const client = new Client({ connectionString });
  console.log("Checking for orphaned ChatMember records...");
  
  try {
    await client.connect();
    
    // Check for chat_members referencing non-existent users
    const res = await client.query(`
      SELECT cm.user_id, cm.room_id 
      FROM chat_members cm 
      LEFT JOIN users u ON cm.user_id = u.id 
      WHERE u.id IS NULL
    `);
    
    console.log(`Found ${res.rowCount} orphaned chat_members records.`);
    if (res.rowCount > 0) {
        console.log("Sample orphans:", res.rows.slice(0, 5));
        
        // Clean them up to allow FK creation
        console.log("Cleaning up orphans...");
        const clean = await client.query(`
            DELETE FROM chat_members 
            WHERE user_id NOT IN (SELECT id FROM users)
        `);
        console.log(`Deleted ${clean.rowCount} orphaned rows.`);
    }

  } catch(e) { 
    console.error("Error:", e.message); 
  } finally { 
    await client.end(); 
  }
}

checkOrphans();
