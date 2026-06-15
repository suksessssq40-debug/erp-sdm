// Migration: Add is_active column to users table
// Default: true (all existing users remain active)
// Usage: node scripts/migrate_user_is_active.cjs

require('dotenv/config');
const { Pool } = require('pg');

async function main() {
  const dbUrl = process.env.DATABASE_URL || process.env.DIRECT_URL;
  if (!dbUrl) {
    console.error('ERROR: DATABASE_URL or DIRECT_URL not set');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: dbUrl });

  try {
    console.log('--- Migration: Add is_active to users ---');
    
    // Step 1: Add column with default true
    console.log('Step 1: Adding is_active column...');
    await pool.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
    `);
    console.log('  Column added (or already exists)');

    // Step 2: Verify
    const result = await pool.query(`
      SELECT column_name, data_type, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'is_active';
    `);
    
    if (result.rows.length > 0) {
      console.log('  Verified:', result.rows[0]);
    } else {
      console.error('  ERROR: Column not found after migration!');
    }

    // Step 3: Count
    const countResult = await pool.query('SELECT COUNT(*) as total FROM users');
    console.log(`  Total users: ${countResult.rows[0].total}`);
    
    const activeResult = await pool.query('SELECT COUNT(*) as active FROM users WHERE is_active = true');
    console.log(`  Active users: ${activeResult.rows[0].active}`);

    console.log('\n--- Migration Complete ---');
  } catch (err) {
    console.error('Migration Error:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
