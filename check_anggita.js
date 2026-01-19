const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres.euxinsbjfukszxzejbop:082139063266@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres' });
async function run() {
    const u = await pool.query("SELECT id FROM users WHERE username = 'anggita'");
    if (u.rows.length > 0) {
        const id = u.rows[0].id;
        console.log('User ID:', id);
        const ta = await pool.query("SELECT * FROM tenant_access WHERE user_id = $1", [id]);
        console.log('Access Records Count:', ta.rows.length);
        ta.rows.forEach(r => console.log(' - Tenant:', r.tenant_id, 'Role:', r.role));
    } else {
        console.log('User not found');
    }
    await pool.end();
}
run();
