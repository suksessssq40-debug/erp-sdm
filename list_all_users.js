
const { Client } = require('pg');

const connectionString = 'postgresql://postgres.euxinsbjfukszxzejbop:082139063266@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres';

async function listUsers() {
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    const res = await client.query(`SELECT id, username, role, tenant_id FROM users LIMIT 20`);
    console.log("All Users:", res.rows);
  } catch(e) { 
    console.error(e); 
  } finally { 
    await client.end(); 
  }
}

listUsers();
