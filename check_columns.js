const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres.euxinsbjfukszxzejbop:082139063266@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres' });
async function run() {
    const res = await pool.query("SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = 'tenant_access'");
    console.log(res.rows);
    await pool.end();
}
run();
