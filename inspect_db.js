require('dotenv/config');
const { Pool } = require('pg');

const PROD_URL = 'postgresql://postgres.opondzzpzxsfucakqwgz:082139063266@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres';
const pool = new Pool({ connectionString: PROD_URL });

async function audit() {
  try {
    const res = await pool.query(`SELECT tenant_id, office_lat, office_lng FROM settings`);
    console.log(`\nSettings Table Content:`);
    res.rows.forEach(s => console.log(` - Tenant: ${s.tenant_id}, Lat: ${s.office_lat}, Lng: ${s.office_lng}`));
    
  } catch (e) {
    console.error("Audit failed:", e);
  } finally {
    await pool.end();
  }
}

audit();
