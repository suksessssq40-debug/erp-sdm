const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });

async function main() {
    const users = await pool.query('SELECT id, name, username, role FROM users');
    console.log('All Users:');
    console.log(JSON.stringify(users.rows, null, 2));

    const target = await pool.query('SELECT name, username FROM users WHERE name ILIKE $1', ['%DWI WAHYU%']);
    console.log('Target User Info:');
    console.log(JSON.stringify(target.rows, null, 2));

    await pool.end();
}

main().catch(e => console.error(e));
