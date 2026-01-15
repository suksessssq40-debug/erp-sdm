
const { Client } = require('pg');

const connectionString = 'postgresql://postgres.euxinsbjfukszxzejbop:082139063266@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres';

async function debugUsers() {
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    // Case insensitive search for owners
    const res = await client.query(`SELECT id, username, role, name, telegram_id, tenant_id FROM users WHERE UPPER(role) = 'OWNER'`);
    console.log("OWNERS found:", res.rows);
  } catch(e) { 
    console.error(e); 
  } finally { 
    await client.end(); 
  }
}

debugUsers();
