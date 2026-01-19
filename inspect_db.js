require('dotenv/config');
const { Pool } = require('pg');

const PROD_URL = 'postgresql://postgres.opondzzpzxsfucakqwgz:082139063266@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres';
const pool = new Pool({ connectionString: PROD_URL });

async function audit() {
  try {
    console.log("--- DEEP AUDIT TENANT ACCESS ---");
    const res = await pool.query(`
        SELECT u.id, u.username, u.role, ta.tenant_id 
        FROM users u
        LEFT JOIN tenant_access ta ON u.id = ta.user_id
        WHERE u.role IN ('MANAGER', 'FINANCE', 'OWNER')
    `);
    
    const summary = {};
    res.rows.forEach(r => {
        if (!summary[r.username]) summary[r.username] = { id: r.id, role: r.role, tenants: [] };
        if (r.tenant_id) summary[r.username].tenants.push(r.tenant_id);
    });

    Object.keys(summary).forEach(username => {
        const u = summary[username];
        console.log(` - ${username} (${u.role}): [${u.tenants.length}] tenants -> ${u.tenants.join(', ') || '❌ NO ACCESS'}`);
    });

  } catch (e) {
    console.error("Audit failed:", e);
  } finally {
    await pool.end();
  }
}

audit();
