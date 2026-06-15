/**
 * create_kaizen_prod.js
 * Create Kaizen tables on production database (SAFE)
 * Uses CREATE IF NOT EXISTS - safe to re-run
 */
const { Client } = require('pg');

const PW = '082139063266';
const PROD_URL = 'postgresql://postgres:' + PW + '@db.jhqlrmlqvdatufbuhtsp.supabase.co:5432/postgres';

const client = new Client({ connectionString: PROD_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  console.log('=== CREATE KAIZEN TABLES ON PRODUCTION ===\n');
  await client.connect();
  console.log('Connected.\n');

  // 1. Check & add Kaizen columns to users
  console.log('--- Step 1: Users Kaizen columns ---');

  const colRes = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name='users'");
  const cols = colRes.rows.map(r => r.column_name);

  if (!cols.includes('is_kaizen_master')) {
    await client.query('ALTER TABLE users ADD COLUMN is_kaizen_master BOOLEAN NOT NULL DEFAULT FALSE');
    console.log('  OK  Added is_kaizen_master');
  } else {
    console.log('  SKIP  is_kaizen_master exists');
  }

  if (!cols.includes('kaizen_points')) {
    await client.query('ALTER TABLE users ADD COLUMN kaizen_points INT NOT NULL DEFAULT 100');
    console.log('  OK  Added kaizen_points');
  } else {
    console.log('  SKIP  kaizen_points exists');
  }

  if (!cols.includes('kaizen_points_reset_at')) {
    await client.query('ALTER TABLE users ADD COLUMN kaizen_points_reset_at TIMESTAMPTZ(6)');
    console.log('  OK  Added kaizen_points_reset_at');
  } else {
    console.log('  SKIP  kaizen_points_reset_at exists');
  }

  // Set defaults for existing users
  await client.query('UPDATE users SET kaizen_points = 100 WHERE kaizen_points IS NULL');
  await client.query('UPDATE users SET is_kaizen_master = FALSE WHERE is_kaizen_master IS NULL');
  console.log('  OK  Defaults set for existing users\n');

  // 2. Create kaizen_deductions table
  console.log('--- Step 2: kaizen_deductions table ---');
  await client.query(`
    CREATE TABLE IF NOT EXISTS kaizen_deductions (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      user_id TEXT NOT NULL REFERENCES users(id),
      deducted_by TEXT NOT NULL,
      amount INT NOT NULL,
      category TEXT NOT NULL,
      reason TEXT,
      created_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
    );
  `);
  console.log('  OK  Table created (or exists)\n');

  // 3. Create indexes
  console.log('--- Step 3: Indexes ---');
  await client.query('CREATE INDEX IF NOT EXISTS idx_kaizen_deductions_user_id ON kaizen_deductions(user_id)');
  console.log('  OK  idx_user_id');
  await client.query('CREATE INDEX IF NOT EXISTS idx_kaizen_deductions_created_at ON kaizen_deductions(created_at DESC)');
  console.log('  OK  idx_created_at\n');

  // 4. Verify
  console.log('--- Verification ---');
  const tableRes = await client.query("SELECT COUNT(*)::int as cnt FROM kaizen_deductions");
  console.log('  kaizen_deductions: ' + tableRes.rows[0].cnt + ' rows');
  
  const userCheck = await client.query("SELECT COUNT(*)::int as cnt FROM users WHERE is_kaizen_master = true");
  console.log('  Kaizen Masters: ' + userCheck.rows[0].cnt);
  
  const pointsCheck = await client.query("SELECT COUNT(*)::int as cnt FROM users WHERE kaizen_points IS NOT NULL");
  console.log('  Users with points: ' + pointsCheck.rows[0].cnt);

  await client.end();
  console.log('\nDONE!');
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
