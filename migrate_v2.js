const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });

async function main() {
    try {
        console.log('Adding is_active column to users table...');
        await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true');
        console.log('Success!');
    } catch (e) {
        console.error('Error adding column:', e);
    } finally {
        await pool.end();
    }
}

main();
