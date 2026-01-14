
const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: 'postgresql://postgres.opondzzpzxsfucakqwgz:082139063266@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres'
  });

  try {
    await client.connect();
    
    // 1. Check if 'level-up' exists
    const check = await client.query("SELECT * FROM tenants WHERE id = 'level-up'");
    console.log("Check 'level-up':", check.rows);

    if (check.rowCount === 0) {
        // 2. Try Manual Insert
        console.log("Attempting INSERT...");
        try {
            const res = await client.query(`
                INSERT INTO "public"."tenants" ("id", "name", "description", "is_active", "created_at") 
                VALUES ('level-up', 'Level Up Office', 'Test', true, NOW()) 
                RETURNING id
            `);
            console.log("INSERT Success:", res.rows[0]);
            
            // Cleanup
            await client.query("DELETE FROM tenants WHERE id = 'level-up'");
            console.log("Cleanup done.");
        } catch (insertErr) {
            console.error("INSERT FAILED:", insertErr.message);
            console.error("Detail:", insertErr.detail);
        }
    } else {
        console.log("Tenant 'level-up' ALREADY EXISTS!");
    }

  } catch (e) {
    console.error('ERROR:', e.message);
  } finally {
    await client.end();
  }
}

main();
