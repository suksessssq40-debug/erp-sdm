
const { Client } = require('pg');

const connectionString = 'postgresql://postgres.opondzzpzxsfucakqwgz:082139063266@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres';

async function checkLevelUp() {
  const client = new Client({ connectionString });
  console.log("Checking Level Up Gaming Attendance...");
  
  try {
    await client.connect();

    // 1. Get Tenant ID for Level Up
    const tenantRes = await client.query(`SELECT id, name FROM tenants WHERE name ILIKE '%level%'`);
    if (tenantRes.rowCount === 0) {
        console.log("❌ Tenant 'Level Up' not found.");
        return;
    }
    const tenantId = tenantRes.rows[0].id; // Likely 'level-up'
    console.log(`Target Tenant: ${tenantRes.rows[0].name} (${tenantId})`);

    // 2. Check Attendance for Jan 14 and Jan 15
    // user said "yesterday" (Jan 14) they checked in.
    const res = await client.query(`
        SELECT id, user_id, date, time_in, time_out, created_at 
        FROM attendance 
        WHERE tenant_id = $1 
        ORDER BY created_at DESC 
        LIMIT 10
    `, [tenantId]);

    console.log("--- Latest Attendance Records ---");
    res.rows.forEach(r => {
        console.log(`ID: ${r.id} | User: ${r.user_id} | Date: ${r.date} | In: ${r.time_in} | Out: ${r.time_out} | CreatedAt: ${r.created_at}`);
    });

  } catch(e) { 
    console.error("Error:", e.message); 
  } finally { 
    await client.end(); 
  }
}

checkLevelUp();
