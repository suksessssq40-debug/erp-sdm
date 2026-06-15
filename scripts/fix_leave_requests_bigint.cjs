require('dotenv/config');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function fix() {
  console.log('Converting leave_requests timestamp columns to bigint...');

  // Convert created_at: timestamptz -> bigint (epoch ms)
  await pool.query(`ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS created_at_new BIGINT;`);
  await pool.query(`
    UPDATE leave_requests
    SET created_at_new = EXTRACT(EPOCH FROM created_at) * 1000
    WHERE created_at IS NOT NULL;
  `);
  await pool.query(`ALTER TABLE leave_requests DROP COLUMN created_at;`);
  await pool.query(`ALTER TABLE leave_requests RENAME COLUMN created_at_new TO created_at;`);
  console.log('created_at converted');

  // Convert action_at: timestamptz -> bigint (epoch ms)
  await pool.query(`ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS action_at_new BIGINT;`);
  await pool.query(`
    UPDATE leave_requests
    SET action_at_new = EXTRACT(EPOCH FROM action_at) * 1000
    WHERE action_at IS NOT NULL;
  `);
  await pool.query(`ALTER TABLE leave_requests DROP COLUMN action_at;`);
  await pool.query(`ALTER TABLE leave_requests RENAME COLUMN action_at_new TO action_at;`);
  console.log('action_at converted');

  // Verify
  const verify = await pool.query(`SELECT id, created_at, action_at FROM leave_requests LIMIT 5`);
  console.log('Verification:', JSON.stringify(verify.rows, null, 2));

  console.log('Done!');
  await pool.end();
}

fix().catch(e => {
  console.error('Error:', e.message);
  pool.end();
});
