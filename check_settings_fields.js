
const { Client } = require('pg');

const connectionString = 'postgresql://postgres.opondzzpzxsfucakqwgz:082139063266@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres';

async function checkSettingsFields() {
  const client = new Client({ connectionString });
  console.log("🚀 Checking Settings Fields for all tenants...");
  
  try {
    await client.connect();

    const res = await client.query('SELECT tenant_id, office_start_time, office_end_time, office_lat, office_lng FROM settings');
    console.table(res.rows);

  } catch(e) { 
    console.error("❌ DB Error:", e); 
  } finally { 
    await client.end(); 
  }
}

checkSettingsFields();
