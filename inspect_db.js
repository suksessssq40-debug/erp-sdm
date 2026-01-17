require('dotenv/config');
const { Pool } = require('pg');

const PROD_URL = 'postgresql://postgres.opondzzpzxsfucakqwgz:082139063266@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres';
const pool = new Pool({ connectionString: PROD_URL });

async function checkSchema() {
  try {
    console.log("--- PRODUCTION SCHEMA AUDIT ---");
    
    const tables = [
        'tenants', 'tenant_access', 'users', 'attendance', 'projects', 
        'transactions', 'financial_accounts', 'chart_of_accounts', 
        'transaction_categories', 'settings', 'daily_reports'
    ];

    for (const table of tables) {
        const res = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = $1 
            ORDER BY column_name
        `, [table]);
        
        console.log(`\n[${table.toUpperCase()}] Columns:`);
        if (res.rowCount === 0) {
            console.log(" ❌ TABLE MISSING!");
        } else {
            res.rows.forEach(c => console.log(` - ${c.column_name} (${c.data_type})`));
        }
    }

  } catch (e) {
    console.error("Schema check failed:", e);
  } finally {
    await pool.end();
  }
}

checkSchema();
