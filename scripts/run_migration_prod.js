/**
 * scripts/run_migration_prod.js
 *
 * Executes migrate_leave_schema.sql against PRODUCTION database.
 * Safe to run multiple times (all steps are idempotent).
 *
 * Usage:
 *   node scripts/run_migration_prod.js
 */

'use strict';

const { Pool }  = require('pg');
const fs        = require('fs');
const path      = require('path');

// ── Production connection (hardcoded — does NOT use .env which points to local) ──
const PROD_URL = 'postgresql://postgres.jhqlrmlqvdatufbuhtsp:082139063266@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres';

const pool = new Pool({ connectionString: PROD_URL, ssl: { rejectUnauthorized: false } });
pool.on('error', (err) => console.warn('[pool idle error]', err.message));

const SQL_PATH = path.resolve(__dirname, 'migrate_leave_schema.sql');

async function run() {
    console.log('\n🚀 Running Leave Schema Migration on PRODUCTION...\n');
    console.log(`   SQL file : ${SQL_PATH}`);
    console.log(`   Target   : aws-1-ap-southeast-1.pooler.supabase.com (PROD)\n`);

    const sql = fs.readFileSync(SQL_PATH, 'utf8');
    const client = await pool.connect();

    try {
        // Execute the entire migration in one transaction for atomicity
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('COMMIT');
        console.log('\n✅ Migration committed successfully.');
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('\n❌ Migration FAILED — rolled back:', err.message);
        console.error(err);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

run();
