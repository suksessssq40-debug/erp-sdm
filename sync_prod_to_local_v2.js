
const { Client } = require('pg');

const SOURCE_DB = 'postgresql://postgres.opondzzpzxsfucakqwgz:082139063266@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres';
const TARGET_DB = 'postgresql://postgres.euxinsbjfukszxzejbop:082139063266@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres';

async function syncDatabase() {
  const source = new Client({ connectionString: SOURCE_DB });
  const target = new Client({ connectionString: TARGET_DB });

  console.log("🚀 RELIABLE SYNC: PROD -> LOCAL (Parameterized)");
  
  try {
    await source.connect();
    await target.connect();

    // A. Disable Constraints
    await target.query(`SET session_replication_role = 'replica';`);

    // B. Get Key Tables (Order matters less in replica mode, but good habit)
    // We explicitly list them to be sure, or just fetch all.
    const resTables = await source.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        AND table_name NOT IN ('_prisma_migrations');
    `);
    const tables = resTables.rows.map(r => r.table_name);

    for (const table of tables) {
        if (table === 'sys_config') continue; // Skip weird tables if any

        console.log(`   🔄 Syncing ${table}...`);
        
        // 1. Truncate
        await target.query(`TRUNCATE TABLE "${table}" CASCADE;`);
        
        // 2. Fetch Data
        const data = await source.query(`SELECT * FROM "${table}"`);
        const rows = data.rows;
        
        if (rows.length === 0) {
            console.log(`      - Skipped (0 rows)`);
            continue;
        }

        const columns = Object.keys(rows[0]).map(c => `"${c}"`).join(', ');
        const placeholders = Object.keys(rows[0]).map((_, idx) => `$${idx + 1}`).join(', ');
        
        // 3. Insert Row-by-Row (Safest)
        let count = 0;
        for (const row of rows) {
            const values = Object.values(row).map(v => {
                // If it's an object/array (and not null/Date), stringify it for Postgres JSON
                if (v !== null && typeof v === 'object' && !(v instanceof Date)) {
                    return JSON.stringify(v);
                }
                return v;
            });
            
            try {
                await target.query(
                    `INSERT INTO "${table}" (${columns}) VALUES (${placeholders})`, 
                    values
                );
                count++;
            } catch(e) {
                console.error(`      ❌ Failed to insert row in ${table}: ${e.message}`);
            }
        }
        console.log(`      - Copied ${count}/${rows.length} rows.`);
    }

    // C. Reset Constraints
    await target.query(`SET session_replication_role = 'origin';`);
    console.log("✅ SYNC COMPLETE.");

  } catch(e) { 
    console.error("❌ FATAL ERROR:", e); 
  } finally { 
    await source.end(); 
    await target.end(); 
  }
}

syncDatabase();
