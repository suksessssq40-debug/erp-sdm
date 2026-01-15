
const { Client } = require('pg');

// 1. PRODUCTION (Source) - The one I fixed
const SOURCE_DB = 'postgresql://postgres.opondzzpzxsfucakqwgz:082139063266@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres';

// 2. LOCAL/DEV (Target) - The one in .env
const TARGET_DB = 'postgresql://postgres.euxinsbjfukszxzejbop:082139063266@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres';

async function syncDatabase() {
  const source = new Client({ connectionString: SOURCE_DB });
  const target = new Client({ connectionString: TARGET_DB });

  console.log("🚀 STARTING DATABASE CLONING: PROD -> LOCAL");
  
  try {
    await source.connect();
    await target.connect();

    // A. Disable Constraints on Target
    console.log("1. Disabling Constraints on Target (Replica Mode)...");
    await target.query(`SET session_replication_role = 'replica';`);

    // B. Get List of Tables
    const resTables = await source.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        AND table_name NOT IN ('_prisma_migrations');
    `);
    const tables = resTables.rows.map(r => r.table_name);
    console.log(`2. Found ${tables.length} tables to sync: ${tables.join(', ')}`);

    for (const table of tables) {
        console.log(`   🔄 Syncing table: ${table}...`);
        
        // 1. Truncate Target
        await target.query(`TRUNCATE TABLE "${table}" CASCADE;`);
        
        // 2. Fetch Data from Source
        const data = await source.query(`SELECT * FROM "${table}"`);
        const rows = data.rows;
        
        if (rows.length === 0) {
            console.log(`      - Skipped (0 rows)`);
            continue;
        }

        // 3. Batch Insert (Naive approach, usually fine for <10k rows)
        // Convert rows to VALUES format strictly handling types
        // Note: For JSON types, we must stringify. For Dates, keep as object/string.
        
        const columns = Object.keys(rows[0]).map(c => `"${c}"`).join(', ');
        
        // Split into chunks of 100 to avoid query size limits
        const chunkSize = 100;
        for (let i = 0; i < rows.length; i += chunkSize) {
            const chunk = rows.slice(i, i + chunkSize);
            
            const values = chunk.map(row => {
                const rowValues = Object.keys(rows[0]).map(key => {
                    const val = row[key];
                    if (val === null) return 'NULL';
                    if (typeof val === 'object' && val instanceof Date) return `'${val.toISOString()}'`; // Postgres handles ISO strings
                    if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`; // JSON -> Escape single quotes
                    if (typeof val === 'number') return val;
                    if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
                    // String -> Escape single quotes
                    return `'${val.toString().replace(/'/g, "''")}'`;
                });
                return `(${rowValues.join(', ')})`;
            }).join(', ');

            await target.query(`INSERT INTO "${table}" (${columns}) VALUES ${values};`);
        }
        console.log(`      - Copied ${rows.length} rows.`);
    }

    // C. Re-enable Constraints (Reset Mode)
    console.log("3. Re-enabling Constraints (Normal Mode)...");
    await target.query(`SET session_replication_role = 'origin';`);

    console.log("✅ CLONING COMPLETE! Local DB is now an exact replica of Production.");

  } catch(e) { 
    console.error("❌ CLONING ERROR:", e); 
  } finally { 
    await source.end(); 
    await target.end(); 
  }
}

syncDatabase();
