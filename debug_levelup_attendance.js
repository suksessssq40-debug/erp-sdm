
const { Client } = require('pg');

const connectionString = 'postgresql://postgres.opondzzpzxsfucakqwgz:082139063266@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres';

async function debugAttendance() {
  const client = new Client({ connectionString });
  console.log("🚀 Debugging Level-Up Attendance...");
  
  try {
    await client.connect();

    // 1. Get Tenant ID for Level Up
    const resTenant = await client.query("SELECT id FROM tenants WHERE id = 'level-up' OR name ILIKE '%level%'");
    const tenantId = resTenant.rows[0]?.id;
    
    if (!tenantId) {
        console.log("❌ Tenant 'level-up' not found.");
        return;
    }
    console.log(`Target Tenant: ${tenantId}`);

    // 2. Get latest 10 attendance records for this tenant
    // We want to see if there are OPEN records (time_out IS NULL) from yesterday
    const resAtt = await client.query(`
        SELECT a.id, u.username, a.date, a.time_in, a.time_out, a.created_at
        FROM attendance a
        JOIN users u ON a.user_id = u.id
        WHERE u.tenant_id = $1
        ORDER BY a.created_at DESC
        LIMIT 10
    `, [tenantId]);

    console.log("\nLatest Attendance Records:");
    console.table(resAtt.rows);

  } catch(e) { 
    console.error("❌ DB Error:", e); 
  } finally { 
    await client.end(); 
  }
}

debugAttendance();
