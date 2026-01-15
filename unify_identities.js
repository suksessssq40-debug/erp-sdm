
const { Client } = require('pg');

const connectionString = 'postgresql://postgres.euxinsbjfukszxzejbop:082139063266@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres';

async function unifyIdentities() {
  const client = new Client({ connectionString });
  console.log("🚀 Starting Identity UNIFICATION (Robust Mode)...");
  
  try {
    await client.connect();

    // 1. Debug: Check what roles actually exist
    const resRoles = await client.query(`SELECT DISTINCT role FROM users`);
    console.log("Existing Roles in DB:", resRoles.rows.map(r => r.role));

    // 2. Find OWNERS (simpler query)
    const resOwners = await client.query(`
        SELECT * FROM users 
        WHERE UPPER(role) = 'OWNER' 
           OR role IS NULL 
           OR username LIKE '%jaka%'
    `);
    const owners = resOwners.rows.filter(u => (u.role && u.role.toUpperCase() === 'OWNER') || (u.username && u.username.includes('jaka')));
    
    console.log(`Found ${owners.length} potential accounts to merge.`);

    // Group by Telegram ID (strongest linker) or Name
    const clusters = {};
    for (const u of owners) {
        // Key: TelegramID if exists, else Name. Normalize logic.
        let key = u.telegram_id || u.name; 
        if (!key) {
           // Fallback: Try to guess from username base (jaka.manjada -> jaka)
           if (u.username) key = u.username.split('.')[0];
        }

        if (!key) continue;
        
        if (!clusters[key]) clusters[key] = [];
        clusters[key].push(u);
    }

    for (const key in clusters) {
        const group = clusters[key];
        // Even if group length is 1, we MUST create a TenantAccess record for it!
        // Because we wiped TenantAccess table (it was empty).
        
        console.log(`\nProcessing Cluster [${key}]: ${group.length} accounts`);
        
        // Identify MASTER: Shortest username
        group.sort((a, b) => (a.username || '').length - (b.username || '').length);
        
        const master = group[0]; 
        
        console.log(`   👑 MASTER: ${master.username} (${master.id}) - Main Tenant: ${master.tenant_id}`);
        
        // Grant Access for ALL accounts in the group (incl. Master's own tenant)
        for (const account of group) {
            if (!account.tenant_id) continue;

            const check = await client.query(
                `SELECT id FROM tenant_access WHERE user_id = $1 AND tenant_id = $2`, 
                [master.id, account.tenant_id]
            );

            if (check.rowCount === 0) {
                // Grant Access to Master
                await client.query(`
                    INSERT INTO tenant_access (id, user_id, tenant_id, role, is_active)
                    VALUES ($1, $2, $3, 'OWNER', true)
                `, [`access_fix_${Math.random().toString(36).substr(2,9)}`, master.id, account.tenant_id]);
                console.log(`      ✅ Granted access to Tenant [${account.tenant_id}]`);
            } else {
                 console.log(`      (Already has access to ${account.tenant_id})`);
            }
        }
        
        // Also: Make sure 'sdm' owner accesses EVERYTHING (Hardcoded requirement from chat history)
        if (master.tenant_id === 'sdm') {
             const allTenants = await client.query(`SELECT id FROM tenants`);
             for (const t of allTenants.rows) {
                 const check = await client.query(`SELECT id FROM tenant_access WHERE user_id = $1 AND tenant_id = $2`, [master.id, t.id]);
                 if (check.rowCount === 0) {
                      await client.query(`
                        INSERT INTO tenant_access (id, user_id, tenant_id, role, is_active)
                        VALUES ($1, $2, $3, 'OWNER', true)
                    `, [`access_god_${Math.random().toString(36).substr(2,9)}`, master.id, t.id]);
                    console.log(`      🌟 SUPER-ACCESS: Granted ${t.id} to SDM Owner`);
                 }
             }
        }
    }

    console.log("\n✅ Unification Complete.");
    
    // Debug: Show result for Master
    if (owners.length > 0) {
        // use owners[0] as master sample if sorting logic worked broadly
        // re-query to be safe
        const masterId = owners[0].id; // Just check the first one found
         const resAccess = await client.query(`SELECT tenant_id, role FROM tenant_access WHERE user_id = $1`, [masterId]);
         console.log(`Verification - Access for ${owners[0].username}:`, resAccess.rows);
    }

  } catch(e) { 
    console.error("❌ Unification Error:", e); 
  } finally { 
    await client.end(); 
  }
}

unifyIdentities();
