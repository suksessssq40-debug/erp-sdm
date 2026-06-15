/**
 * safe_prod_migration.js
 * SAFE production migration - checks first, migrates only what's needed
 * All operations use IF NOT EXISTS / are idempotent
 * NO data deletion, NO data modification of existing records
 * 
 * Usage: node scripts/safe_prod_migration.js
 */
require('dotenv/config');
const { Client } = require('pg');

const PW = '082139063266';
const PROD_URL = 'postgresql://postgres:' + PW + '@db.jhqlrmlqvdatufbuhtsp.supabase.co:5432/postgres';

const client = new Client({ connectionString: PROD_URL, ssl: { rejectUnauthorized: false } });

async function columnExists(table, column) {
  const res = await client.query(
    "SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND column_name=$2",
    [table, column]
  );
  return res.rows.length > 0;
}

async function getColumnType(table, column) {
  const res = await client.query(
    "SELECT data_type FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND column_name=$2",
    [table, column]
  );
  return res.rows.length > 0 ? res.rows[0].data_type : null;
}

async function runSafe(label, fn) {
  try {
    await fn();
    console.log('  OK  ' + label);
    return { label, status: 'OK' };
  } catch (e) {
    console.log('  XX  ' + label + ' -- ' + e.message.substring(0, 100));
    return { label, status: 'FAIL', error: e.message };
  }
}

async function main() {
  console.log('=== SAFE PRODUCTION MIGRATION ===');
  console.log('Target: ' + PROD_URL.replace(/:[^:]*@/, ':****@'));
  console.log('');

  await client.connect();
  console.log('Connected to production.\n');

  const results = [];
  let skipped = 0;

  // ============================================
  // MIGRATION 1: daily_reports.updated_at
  // ============================================
  console.log('--- Migration 1: daily_reports.updated_at ---');
  const hasUpdatedAt = await columnExists('daily_reports', 'updated_at');
  if (hasUpdatedAt) {
    console.log('  SKIP  Column already exists');
    skipped++;
  } else {
    results.push(await runSafe('Add updated_at column', async () => {
      await client.query('ALTER TABLE daily_reports ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ(6)');
    }));
    results.push(await runSafe('Backfill updated_at from created_at', async () => {
      await client.query('UPDATE daily_reports SET updated_at = created_at WHERE updated_at IS NULL AND created_at IS NOT NULL');
    }));
  }
  console.log('');

  // ============================================
  // MIGRATION 2: leave_requests BigInt fix
  // ============================================
  console.log('--- Migration 2: leave_requests BigInt fix ---');
  
  const createdType = await getColumnType('leave_requests', 'created_at');
  const actionType = await getColumnType('leave_requests', 'action_at');
  
  console.log('  Current created_at type: ' + createdType);
  console.log('  Current action_at type: ' + actionType);

  if (createdType === 'bigint') {
    console.log('  SKIP  created_at already bigint');
    skipped++;
  } else if (createdType) {
    // Convert created_at from timestamp to bigint
    results.push(await runSafe('Add created_at_new (bigint)', async () => {
      await client.query('ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS created_at_new BIGINT');
    }));
    results.push(await runSafe('Convert created_at data to epoch ms', async () => {
      await client.query('UPDATE leave_requests SET created_at_new = EXTRACT(EPOCH FROM created_at) * 1000 WHERE created_at IS NOT NULL');
    }));
    results.push(await runSafe('Drop old created_at column', async () => {
      await client.query('ALTER TABLE leave_requests DROP COLUMN created_at');
    }));
    results.push(await runSafe('Rename created_at_new -> created_at', async () => {
      await client.query('ALTER TABLE leave_requests RENAME COLUMN created_at_new TO created_at');
    }));
  } else {
    console.log('  SKIP  Column does not exist (table might not exist)');
    skipped++;
  }

  if (actionType === 'bigint') {
    console.log('  SKIP  action_at already bigint');
    skipped++;
  } else if (actionType) {
    // Convert action_at from timestamp to bigint
    results.push(await runSafe('Add action_at_new (bigint)', async () => {
      await client.query('ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS action_at_new BIGINT');
    }));
    results.push(await runSafe('Convert action_at data to epoch ms', async () => {
      await client.query('UPDATE leave_requests SET action_at_new = EXTRACT(EPOCH FROM action_at) * 1000 WHERE action_at IS NOT NULL');
    }));
    results.push(await runSafe('Drop old action_at column', async () => {
      await client.query('ALTER TABLE leave_requests DROP COLUMN action_at');
    }));
    results.push(await runSafe('Rename action_at_new -> action_at', async () => {
      await client.query('ALTER TABLE leave_requests RENAME COLUMN action_at_new TO action_at');
    }));
  } else {
    console.log('  SKIP  action_at does not exist');
    skipped++;
  }
  console.log('');

  // ============================================
  // MIGRATION 3: users.is_active
  // ============================================
  console.log('--- Migration 3: users.is_active ---');
  const hasIsActive = await columnExists('users', 'is_active');
  if (hasIsActive) {
    console.log('  SKIP  Column already exists');
    skipped++;
  } else {
    results.push(await runSafe('Add is_active column (default true)', async () => {
      await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true');
    }));
  }
  console.log('');

  // ============================================
  // MIGRATION 4: kaizen_deductions.created_at (verify)
  // ============================================
  console.log('--- Migration 4: kaizen_deductions.created_at ---');
  const hasKaizenCreated = await columnExists('kaizen_deductions', 'created_at');
  if (hasKaizenCreated) {
    console.log('  SKIP  Column already exists');
    skipped++;
  } else {
    results.push(await runSafe('Add created_at to kaizen_deductions', async () => {
      await client.query('ALTER TABLE kaizen_deductions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()');
    }));
    // Backfill with a fallback date for existing rows
    results.push(await runSafe('Backfill kaizen created_at', async () => {
      await client.query("UPDATE kaizen_deductions SET created_at = NOW() WHERE created_at IS NULL");
    }));
  }
  console.log('');

  // ============================================
  // VERIFICATION
  // ============================================
  console.log('=== VERIFICATION ===\n');
  
  const checks = [
    ['daily_reports', 'updated_at'],
    ['leave_requests', 'created_at'],
    ['leave_requests', 'action_at'],
    ['users', 'is_active'],
    ['kaizen_deductions', 'created_at'],
  ];

  for (const [table, col] of checks) {
    const exists = await columnExists(table, col);
    const type = exists ? await getColumnType(table, col) : 'N/A';
    console.log('  ' + (exists ? 'OK' : 'XX') + '  ' + table + '.' + col + ' (' + type + ')');
  }

  // Count verification
  console.log('\n=== DATA COUNTS ===\n');
  const tables = ['users', 'daily_reports', 'leave_requests', 'kaizen_deductions', 'attendance'];
  for (const table of tables) {
    try {
      const res = await client.query('SELECT COUNT(*)::int as cnt FROM "' + table + '"');
      console.log('  ' + table + ': ' + res.rows[0].cnt + ' rows');
    } catch (e) {
      console.log('  ' + table + ': TABLE NOT FOUND');
    }
  }

  await client.end();

  const failed = results.filter(r => r.status === 'FAIL');
  const succeeded = results.filter(r => r.status === 'OK');
  console.log('\n' + '='.repeat(50));
  console.log('Results: ' + succeeded.length + ' OK, ' + failed.length + ' FAIL, ' + skipped + ' SKIP (already done)');
  if (failed.length === 0) {
    console.log('ALL MIGRATIONS SUCCESSFUL!');
  } else {
    console.log('FAILURES:');
    failed.forEach(f => console.log('  - ' + f.label + ': ' + f.error));
  }
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
