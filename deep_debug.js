
const { Client } = require('pg');

const connectionString = 'postgresql://postgres.euxinsbjfukszxzejbop:082139063266@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres';

async function deepDebug() {
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    
    // 1. Check Tables
    const resTables = await client.query(`SELECT table_schema, table_name FROM information_schema.tables WHERE table_name = 'users'`);
    console.log("Table 'users' found in:", resTables.rows);

    // 2. Count Rows
    const resCount = await client.query(`SELECT COUNT(*) FROM users`);
    console.log("Row Count in 'users':", resCount.rows[0].count);

    // 3. Insert specific user if empty (Test Write)
    if (resCount.rows[0].count == 0) {
        console.log("Attempting Test Insert...");
        try {
            await client.query(`INSERT INTO users (id, name, username, role, tenant_id) VALUES ('test_rec', 'Test', 'test', 'OWNER', 'sdm')`);
            console.log("Test Insert Success!");
        } catch(e) {
            console.log("Test Insert Failed:", e.message);
        }
    }

  } catch(e) { 
    console.error(e); 
  } finally { 
    await client.end(); 
  }
}

deepDebug();
