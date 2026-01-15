
const { Client } = require('pg');

const connectionString = 'postgresql://postgres.euxinsbjfukszxzejbop:082139063266@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres';

async function migrateRoles() {
  const client = new Client({ connectionString });
  console.log("🚀 Starting Identity Migration: Legacy Role -> TenantAccess...");
  
  try {
    await client.connect();

    // 1. Get all users
    const resUsers = await client.query(`SELECT id, role, tenant_id FROM users`);
    const users = resUsers.rows;
    console.log(`Found ${users.length} users to migrate.`);

    for (const u of users) {
        if (!u.tenant_id) continue;

        // Check if Access already exists
        const check = await client.query(`SELECT id FROM tenant_access WHERE user_id = $1 AND tenant_id = $2`, [u.id, u.tenant_id]);
        
        if (check.rowCount === 0) {
            // Create Access Record
            await client.query(`
                INSERT INTO tenant_access (id, user_id, tenant_id, role, is_active)
                VALUES ($1, $2, $3, $4, true)
            `, [`access_${Math.random().toString(36).substr(2,9)}`, u.id, u.tenant_id, u.role]);
            
            console.log(`   + Created Access for ${u.id} in ${u.tenant_id} as ${u.role}`);
        }
    }
    
    // 2. Special Case: Owner SDM needs access to All Tenants (Optional, based on your request)
    // Find Owner SDM
    const resOwner = await client.query(`SELECT id FROM users WHERE role = 'OWNER' AND tenant_id = 'sdm' LIMIT 1`);
    if (resOwner.rowCount > 0) {
        const ownerId = resOwner.rows[0].id;
        const resTenants = await client.query(`SELECT id FROM tenants WHERE id != 'sdm'`);
        
        for (const t of resTenants.rows) {
             const check = await client.query(`SELECT id FROM tenant_access WHERE user_id = $1 AND tenant_id = $2`, [ownerId, t.id]);
             if (check.rowCount === 0) {
                 await client.query(`
                    INSERT INTO tenant_access (id, user_id, tenant_id, role, is_active)
                    VALUES ($1, $2, $3, 'OWNER', true)
                `, [`access_multi_${Math.random().toString(36).substr(2,9)}`, ownerId, t.id]);
                 console.log(`   🌟 Granted Multi-Tenant Access to Owner SDM for: ${t.id}`);
             }
        }
    }

    console.log("✅ Identity Migration Complete.");

  } catch(e) { 
    console.error("❌ Migration Error:", e); 
  } finally { 
    await client.end(); 
  }
}

migrateRoles();
