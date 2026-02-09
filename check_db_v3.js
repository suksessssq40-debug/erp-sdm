const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });

async function main() {
    try {
        console.log('--- PUBLIC.USERS ---');
        const usersCols = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'users'
    `);
        console.log(usersCols.rows);

        console.log('\n--- PUBLIC.TENANT_ACCESS ---');
        const taCols = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'tenant_access'
    `);
        console.log(taCols.rows);

        console.log('\n--- ATTEMPTING A RAW QUERY TO VERIFY ---');
        try {
            const testUser = await pool.query('SELECT is_active FROM users LIMIT 1');
            console.log('Users is_active check SUCCESS');
        } catch (e) {
            console.log('Users is_active check FAILED:', e.message);
        }

        try {
            const testTA = await pool.query('SELECT is_active FROM tenant_access LIMIT 1');
            console.log('TenantAccess is_active check SUCCESS');
        } catch (e) {
            console.log('TenantAccess is_active check FAILED:', e.message);
        }

    } catch (e) {
        console.error('Error:', e);
    } finally {
        await pool.end();
    }
}

main();
