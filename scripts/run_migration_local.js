/**
 * scripts/run_migration_local.js
 *
 * Executes schema migration against LOCAL database.
 * Handles both cases: created_at as BigInt OR already TIMESTAMPTZ.
 *
 * Usage:
 *   node scripts/run_migration_local.js
 */

'use strict';

const { Pool } = require('pg');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

// LOCAL database (from .env DATABASE_URL)
const LOCAL_URL = process.env.DATABASE_URL;
if (!LOCAL_URL) {
    console.error('❌ DATABASE_URL not set in .env');
    process.exit(1);
}

const pool = new Pool({
    connectionString: LOCAL_URL,
    ssl: LOCAL_URL.includes('supabase') ? { rejectUnauthorized: false } : false,
});
pool.on('error', (err) => console.warn('[pool idle error]', err.message));

async function run() {
    console.log('\n🚀 Running Schema Migration on LOCAL database...\n');

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // ── STEP 1: Add SOP policy columns to tenants (idempotent) ──
        const tenantColCheck = await client.query(`
            SELECT column_name FROM information_schema.columns
            WHERE table_name='tenants' AND column_name='leave_weekly_limit'
        `);
        if (tenantColCheck.rows.length === 0) {
            await client.query(`
                ALTER TABLE tenants ADD COLUMN IF NOT EXISTS leave_weekly_limit    INTEGER NOT NULL DEFAULT 1;
                ALTER TABLE tenants ADD COLUMN IF NOT EXISTS leave_annual_quota    INTEGER NOT NULL DEFAULT 12;
                ALTER TABLE tenants ADD COLUMN IF NOT EXISTS leave_sudden_penalty  INTEGER NOT NULL DEFAULT 2;
                ALTER TABLE tenants ADD COLUMN IF NOT EXISTS leave_notice_threshold INTEGER NOT NULL DEFAULT 2;
                ALTER TABLE tenants ADD COLUMN IF NOT EXISTS leave_notice_required  INTEGER NOT NULL DEFAULT 7;
                ALTER TABLE tenants ADD COLUMN IF NOT EXISTS leave_sudden_hour_cutoff INTEGER NOT NULL DEFAULT 16;
            `);
            console.log('✅ STEP 1: Tenant SOP columns added.');
        } else {
            console.log('⏭️  STEP 1: Tenant SOP columns already exist — skipped.');
        }

        // ── STEP 2: Add enforcement columns to leave_requests ──
        const reqColCheck = await client.query(`
            SELECT column_name FROM information_schema.columns
            WHERE table_name='leave_requests' AND column_name='is_sudden'
        `);
        if (reqColCheck.rows.length === 0) {
            await client.query(`
                ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS is_sudden       BOOLEAN DEFAULT FALSE;
                ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS has_doctor_note BOOLEAN DEFAULT FALSE;
                ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS penalty_weight  INTEGER DEFAULT 1;
            `);
            console.log('✅ STEP 2: leave_requests enforcement columns added.');
        } else {
            console.log('⏭️  STEP 2: leave_requests enforcement columns already exist — skipped.');
        }

        // ── STEP 3: Smart created_at / action_at migration ──
        // Check what type created_at actually is
        const typeCheck = await client.query(`
            SELECT data_type FROM information_schema.columns
            WHERE table_name = 'leave_requests' AND column_name = 'created_at'
        `);

        const colType = typeCheck.rows[0]?.data_type || '';
        console.log(`ℹ️  STEP 3: leave_requests.created_at is currently: ${colType}`);

        if (colType === 'bigint' || colType === 'int8') {
            // BigInt path — need to convert
            console.log('   → Converting BigInt milliseconds to TIMESTAMPTZ...');
            await client.query(`
                ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS created_at_new TIMESTAMPTZ;
                UPDATE leave_requests
                SET created_at_new = CASE
                    WHEN created_at IS NOT NULL AND created_at > 0
                      THEN to_timestamp(created_at::BIGINT / 1000.0)
                    ELSE NOW()
                END;
                ALTER TABLE leave_requests DROP COLUMN created_at;
                ALTER TABLE leave_requests RENAME COLUMN created_at_new TO created_at;
                ALTER TABLE leave_requests ALTER COLUMN created_at SET DEFAULT NOW();
            `);
            // Same for action_at
            const actionTypeCheck = await client.query(`
                SELECT data_type FROM information_schema.columns
                WHERE table_name='leave_requests' AND column_name='action_at'
            `);
            if ((actionTypeCheck.rows[0]?.data_type || '') === 'bigint') {
                await client.query(`
                    ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS action_at_new TIMESTAMPTZ;
                    UPDATE leave_requests
                    SET action_at_new = CASE
                        WHEN action_at IS NOT NULL AND action_at > 0
                          THEN to_timestamp(action_at::BIGINT / 1000.0)
                        ELSE NULL
                    END;
                    ALTER TABLE leave_requests DROP COLUMN action_at;
                    ALTER TABLE leave_requests RENAME COLUMN action_at_new TO action_at;
                `);
            }
            console.log('✅ STEP 3: created_at/action_at migrated BigInt → TIMESTAMPTZ.');
        } else {
            // Already TIMESTAMPTZ — just ensure action_at column exists with correct type
            await client.query(`
                ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS action_at TIMESTAMPTZ;
            `);
            console.log('✅ STEP 3: created_at already TIMESTAMPTZ — no conversion needed.');
        }

        // ── STEP 4: Create leave_quotas table ──
        await client.query(`
            CREATE TABLE IF NOT EXISTS leave_quotas (
                id              TEXT        PRIMARY KEY,
                user_id         TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                year            INTEGER     NOT NULL,
                total_quota     INTEGER     NOT NULL DEFAULT 12,
                used_quota      INTEGER     NOT NULL DEFAULT 0,
                remaining_quota INTEGER     NOT NULL DEFAULT 12,
                tenant_id       TEXT        DEFAULT 'sdm' REFERENCES tenants(id) ON DELETE CASCADE,
                CONSTRAINT leave_quotas_user_year_unique UNIQUE (user_id, year)
            );
        `);
        console.log('✅ STEP 4: leave_quotas table ready.');

        // ── STEP 5: Prune system_logs > 30 days (optional for local) ──
        const pruneRes = await client.query(`
            DELETE FROM system_logs
            WHERE to_timestamp(timestamp / 1000.0) < NOW() - INTERVAL '30 days'
        `);
        console.log(`✅ STEP 5: system_logs pruned — ${pruneRes.rowCount ?? 0} old rows deleted.`);

        await client.query('COMMIT');
        console.log('\n🎉 LOCAL migration committed successfully!\n');

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
