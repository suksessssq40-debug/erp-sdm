const { Pool } = require('pg');

// PRODUCTION DB DATA from User Request
const prodConfig = {
    connectionString: "postgresql://postgres.jhqlrmlqvdatufbuhtsp:082139063266@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres",
};

async function main() {
    const pool = new Pool(prodConfig);
    try {
        console.log('AUDITING PRODUCTION DATABASE SCHEMA...');

        console.log('\n--- Checking USERS table in PRODUCTION ---');
        const usersCols = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users'");
        const userColNames = usersCols.rows.map(r => r.column_name);
        console.log('Production Users columns:', userColNames);

        if (!userColNames.includes('is_active')) {
            console.log('MISSING is_active in users. Adding it...');
            await pool.query('ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT true');
            console.log('SUCCESS: Added is_active to users.');
        }

        console.log('\n--- Checking TENANT_ACCESS table in PRODUCTION ---');
        const taCols = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tenant_access'");
        const taColNames = taCols.rows.map(r => r.column_name);
        console.log('Production TenantAccess columns:', taColNames);

        if (!taColNames.includes('is_active')) {
            console.log('MISSING is_active in tenant_access. Adding it...');
            await pool.query('ALTER TABLE tenant_access ADD COLUMN is_active BOOLEAN DEFAULT true');
            console.log('SUCCESS: Added is_active to tenant_access.');
        }

    } catch (e) {
        console.error('FATAL ERROR DURING AUDIT:', e.message);
    } finally {
        await pool.end();
    }
}

main();
