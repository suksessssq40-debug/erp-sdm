const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });

async function main() {
    const dummyAvatar = 'https://euxinsbjfukszxzejbop.supabase.co/storage/v1/object/public/uploads/dummy-test.png';
    const res = await pool.query('UPDATE users SET avatar_url = $1 WHERE username = $2 RETURNING id, name, avatar_url', [dummyAvatar, 'dwi_123']);
    console.log('Update Result:');
    console.log(JSON.stringify(res.rows, null, 2));

    // Verify
    const verify = await pool.query('SELECT name, avatar_url FROM users WHERE username = $1', ['dwi_123']);
    console.log('Verification:');
    console.log(JSON.stringify(verify.rows, null, 2));

    // Cleanup (optional, but good to restore null if it was null)
    // await pool.query('UPDATE users SET avatar_url = NULL WHERE username = $2', ['dwi_123']);

    await pool.end();
}

main().catch(e => console.error(e));
