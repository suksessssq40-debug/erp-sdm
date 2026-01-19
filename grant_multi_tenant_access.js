require('dotenv/config');
const { Pool } = require('pg');

const databaseUrl = 'postgresql://postgres.euxinsbjfukszxzejbop:082139063266@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres';
const pool = new Pool({ connectionString: databaseUrl });

async function grantAccess() {
  try {
    console.log("--- GRANTING MULTI-TENANT ACCESS TO MANAGERS & FINANCE ---");
    
    // 1. Get All Tenants
    const tenantsRes = await pool.query(`SELECT id FROM tenants`);
    const tenantIds = tenantsRes.rows.map(t => t.id);
    console.log(`Found ${tenantIds.length} units: ${tenantIds.join(', ')}`);

    // 2. Get All Managers and Finance users
    const usersRes = await pool.query(`SELECT id, username, role FROM users WHERE role IN ('MANAGER', 'FINANCE')`);
    const targets = usersRes.rows;
    console.log(`Found ${targets.length} target users.`);

    for (const u of targets) {
        console.log(`\nGranting access for ${u.username} (${u.role})...`);
        for (const tid of tenantIds) {
            const accessId = `acc_${u.id}_${tid}`;
            // Upsert into tenant_access
            await pool.query(`
                INSERT INTO tenant_access (id, user_id, tenant_id, role, is_active)
                VALUES ($1, $2, $3, $4, true)
                ON CONFLICT (user_id, tenant_id) DO UPDATE SET 
                  role = EXCLUDED.role,
                  is_active = true
            `, [accessId, u.id, tid, u.role]);
            console.log(` ✅ Access to ${tid} granted (ID: ${accessId}).`);
        }
    }

    console.log("\n--- ACCESS MIGRATION COMPLETED ---");
  } catch (e) {
    console.error("Migration failed:", e);
  } finally {
    await pool.end();
  }
}

grantAccess();
