
const { Client } = require('pg');

const connectionString = 'postgresql://postgres.opondzzpzxsfucakqwgz:082139063266@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres';

async function checkTenantIntegrity() {
  const client = new Client({ connectionString });
  console.log("🚀 Starting Tenant Data Integrity Check...");
  
  try {
    await client.connect();

    // 1. Get All Tenants
    const resTenants = await client.query('SELECT id, name FROM tenants');
    const tenants = resTenants.rows;
    console.log(`Found ${tenants.length} tenants:`, tenants.map(t => t.id).join(', '));

    for (const t of tenants) {
        console.log(`\nChecking Tenant [${t.id}] (${t.name}):`);
        
        // 2. Check Settings
        const resSettings = await client.query(`SELECT id FROM settings WHERE tenant_id = $1`, [t.id]);
        if (resSettings.rowCount === 0) {
            console.error(`   ❌ CRITICAL: Missing 'Settings' record!`);
            // Attempt Auto-Fix?
            // console.log("      Attempting to create default settings...");
            // ...
        } else {
            console.log(`   ✅ Settings found.`);
        }

        // 3. Check Chat Rooms
        const resChat = await client.query(`SELECT count(*) FROM chat_rooms WHERE tenant_id = $1`, [t.id]);
        console.log(`   ℹ️ Chat Rooms: ${resChat.rows[0].count}`);

        // 4. Check Valid Users (Owner existence)
        const resUsers = await client.query(`
            SELECT u.username, ta.role 
            FROM tenant_access ta
            JOIN users u ON u.id = ta.user_id
            WHERE ta.tenant_id = $1 AND ta.role = 'OWNER'
        `, [t.id]);
        
        if (resUsers.rowCount === 0) {
             console.warn(`   ⚠️ Warning: No OWNER access found in tenant_access.`);
        } else {
             console.log(`   ✅ Owners: ${resUsers.rows.map(u => u.username).join(', ')}`);
        }
    }

  } catch(e) { 
    console.error("❌ Integrity Check Error:", e); 
  } finally { 
    await client.end(); 
  }
}

checkTenantIntegrity();
