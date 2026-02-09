const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });

async function main() {
    try {
        console.log('Checking columns for users...');
        const usersCols = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'users'");
        console.log('Users columns:', usersCols.rows.map(r => r.column_name));

        console.log('\nChecking columns for tenant_access...');
        const taCols = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'tenant_access'");
        console.log('TenantAccess columns:', taCols.rows.map(r => r.column_name));
    } catch (e) {
        console.error('Error checking columns:', e);
    } finally {
        await pool.end();
    }
}

main();
