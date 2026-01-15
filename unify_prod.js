
const { Client } = require('pg');

// PRODUCTION CONNECTION STRING (TARGET)
const connectionString = 'postgresql://postgres.opondzzpzxsfucakqwgz:082139063266@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres';

async function unifyIdentitiesProd() {
  const client = new Client({ connectionString });
  console.log("🚀 Starting PRODUCTION Identity UNIFICATION...");
  console.log("⚠️  WARNING: This will modify LIVE Access Rights.");
  
  try {
    await client.connect();

    // 1. Snapshot Before Change (Safety Audit)
    const countBefore = await client.query('SELECT COUNT(*) FROM tenant_access');
    console.log(`Current Access Records: ${countBefore.rows[0].count}`);

    // 2. Find OWNERS (Simpler Query matching Local Logic)
    // We look for any user that is an OWNER or matches 'jaka'
    // This targets the cluster we identified in local testing
    const resOwners = await client.query(`
        SELECT * FROM users 
        WHERE UPPER(role) = 'OWNER' 
           OR role IS NULL 
           OR username LIKE '%jaka%'
    `);
    
    // Filter in JS to be safe
    const owners = resOwners.rows.filter(u => 
        (u.role && u.role.toUpperCase() === 'OWNER') || 
        (u.username && u.username.includes('jaka'))
    );
    
    console.log(`Found ${owners.length} potential owner accounts to merge.`);

    // 3. Group Logic (Telegram ID > Name > Username Base)
    const clusters = {};
    for (const u of owners) {
        let key = u.telegram_id || u.name; 
        if (!key && u.username) key = u.username.split('.')[0];
        if (!key) continue;
        
        if (!clusters[key]) clusters[key] = [];
        clusters[key].push(u);
    }

    // 4. Execute Merge
    for (const key in clusters) {
        const group = clusters[key];
        
        // Sorting: Shortest username is MASTER (e.g. 'jaka' < 'jaka.manjada')
        group.sort((a, b) => (a.username || '').length - (b.username || '').length);
        const master = group[0]; 
        
        console.log(`\nProcessing Cluster [${key}]:`);
        console.log(`   👑 MASTER: ${master.username} (${master.id}) [Tenant: ${master.tenant_id}]`);

        // Give Master access to ALL tenants in the group
        for (const account of group) {
            if (!account.tenant_id) continue;

            // Idempotency Check: Don't insert duplicate access
            const check = await client.query(
                `SELECT id FROM tenant_access WHERE user_id = $1 AND tenant_id = $2`, 
                [master.id, account.tenant_id]
            );

            if (check.rowCount === 0) {
                await client.query(`
                    INSERT INTO tenant_access (id, user_id, tenant_id, role, is_active)
                    VALUES ($1, $2, $3, 'OWNER', true)
                `, [`prod_acc_${Math.random().toString(36).substr(2,9)}`, master.id, account.tenant_id]);
                console.log(`      ✅ Granted access to [${account.tenant_id}]`);
            } else {
                console.log(`      (Already has access to ${account.tenant_id})`);
            }
        }
        
        // Special Rule: 'sdm' Master gets access to ALL tenants (Super Owner)
        if (master.tenant_id === 'sdm') {
             const allTenants = await client.query(`SELECT id FROM tenants`);
             for (const t of allTenants.rows) {
                 const check = await client.query(`SELECT id FROM tenant_access WHERE user_id = $1 AND tenant_id = $2`, [master.id, t.id]);
                 if (check.rowCount === 0) {
                      await client.query(`
                        INSERT INTO tenant_access (id, user_id, tenant_id, role, is_active)
                        VALUES ($1, $2, $3, 'OWNER', true)
                    `, [`prod_god_${Math.random().toString(36).substr(2,9)}`, master.id, t.id]);
                    console.log(`      🌟 SUPER-ACCESS: Granted [${t.id}] to SDM Owner`);
                 }
             }
        }
    }

    console.log("\n✅ Production Unification Complete.");

  } catch(e) { 
    console.error("❌ PROD ERROR:", e); 
  } finally { 
    await client.end(); 
  }
}

unifyIdentitiesProd();
