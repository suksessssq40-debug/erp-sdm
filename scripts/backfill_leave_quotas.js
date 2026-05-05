/**
 * scripts/backfill_leave_quotas.js
 *
 * Run ONCE after deploying the new schema to production to compute
 * historical leave quota usage for every staff member.
 *
 * Usage:
 *   node scripts/backfill_leave_quotas.js
 *
 * What it does:
 *  1. Reads ALL tenants and their leave policy (annual quota, penalty, etc.)
 *  2. For each tenant, reads ALL APPROVED leave requests (grouped by user + year)
 *  3. Calculates used quota = SUM(penaltyWeight * durationDays) per APPROVED request
 *     (Sick with doctor note = penaltyWeight 0, so contributes 0)
 *  4. Upserts into leave_quotas table
 *
 * Safe to re-run — uses UPSERT (ON CONFLICT DO UPDATE).
 */

'use strict';

const { Pool } = require('pg');
const { randomBytes } = require('crypto');

// Use same connection as app (.env DATABASE_URL)
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('supabase') ? { rejectUnauthorized: false } : false,
});
pool.on('error', (err) => console.warn('[pool idle error]', err.message));

function nanoid(size = 9) {
    return randomBytes(size).toString('base64url').slice(0, size);
}

/** Calculate duration in days inclusive (startDate to endDate). */
function calcDays(startDate, endDate) {
    if (!startDate) return 1;
    const s = new Date(startDate);
    const e = endDate ? new Date(endDate) : new Date(startDate);
    const diffMs = Math.abs(e.getTime() - s.getTime());
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24)) + 1;
}

async function run() {
    console.log('\n🚀 Backfill Leave Quotas — Starting...\n');

    const client = await pool.connect();

    try {
        // 1. Load all tenants with their quota policy
        const tenantsRes = await client.query(`
            SELECT id, leave_annual_quota, leave_sudden_penalty
            FROM tenants
            ORDER BY id
        `);
        const tenants = tenantsRes.rows;
        console.log(`📋 Found ${tenants.length} tenant(s).\n`);

        for (const tenant of tenants) {
            const { id: tenantId, leave_annual_quota: annualQuota } = tenant;
            console.log(`\n📦 Processing tenant: [${tenantId}] (quota=${annualQuota})`);

            // 2. Load all APPROVED leave requests for this tenant
            //    Only requests with penaltyWeight > 0 consume quota.
            // NOTE: created_at is now TIMESTAMPTZ (BigInt migration already ran)
            const reqRes = await client.query(`
                SELECT
                    lr.user_id,
                    lr.start_date,
                    lr.end_date,
                    lr.type,
                    COALESCE(lr.penalty_weight, 1)::INT  AS penalty_weight,
                    COALESCE(lr.has_doctor_note, FALSE)  AS has_doctor_note,
                    EXTRACT(YEAR FROM COALESCE(
                        lr.start_date,
                        lr.created_at
                    ))::INT AS req_year
                FROM leave_requests lr
                WHERE lr.tenant_id = $1
                  AND lr.status = 'APPROVED'
                  AND lr.user_id IS NOT NULL
            `, [tenantId]);

            // 3. Aggregate: Map<userId, Map<year, usedQuota>>
            const usageMap = new Map(); // userId -> year -> usedDays

            for (const row of reqRes.rows) {
                const { user_id, start_date, end_date, type, penalty_weight, has_doctor_note, req_year } = row;
                if (!user_id || !req_year) continue;

                // Sick with doctor note = penalty 0 → no quota consumed
                const effectivePenalty = (type?.toUpperCase() === 'SAKIT' && has_doctor_note)
                    ? 0
                    : (penalty_weight ?? 1);

                if (effectivePenalty === 0) continue;

                const days = calcDays(start_date, end_date);
                const consumed = effectivePenalty * days;

                if (!usageMap.has(user_id)) usageMap.set(user_id, new Map());
                const yearMap = usageMap.get(user_id);
                yearMap.set(req_year, (yearMap.get(req_year) || 0) + consumed);
            }

            // 4. Also ensure rows exist for users who NEVER took leave (0 used)
            //    so the frontend always has a quota row to display.
            const usersRes = await client.query(`
                SELECT u.id
                FROM users u
                INNER JOIN tenant_access ta ON ta.user_id = u.id AND ta.tenant_id = $1
                WHERE u.is_active = TRUE
            `, [tenantId]);

            const currentYear = new Date().getFullYear();
            for (const { id: userId } of usersRes.rows) {
                if (!usageMap.has(userId)) {
                    usageMap.set(userId, new Map([[currentYear, 0]]));
                } else if (!usageMap.get(userId).has(currentYear)) {
                    usageMap.get(userId).set(currentYear, 0);
                }
            }

            // 5. Upsert all computed quotas
            let upserted = 0;
            let skipped = 0;

            for (const [userId, yearMap] of usageMap.entries()) {
                for (const [year, usedQuota] of yearMap.entries()) {
                    const remainingQuota = Math.max(0, annualQuota - usedQuota);

                    await client.query(`
                        INSERT INTO leave_quotas
                            (id, user_id, year, total_quota, used_quota, remaining_quota, tenant_id)
                        VALUES ($1, $2, $3, $4, $5, $6, $7)
                        ON CONFLICT (user_id, year) DO UPDATE SET
                            total_quota     = EXCLUDED.total_quota,
                            used_quota      = EXCLUDED.used_quota,
                            remaining_quota = EXCLUDED.remaining_quota
                    `, [
                        nanoid(),
                        userId,
                        year,
                        annualQuota,
                        usedQuota,
                        remainingQuota,
                        tenantId
                    ]);

                    console.log(`   ✅ user=${userId} year=${year} used=${usedQuota} remaining=${remainingQuota}`);
                    upserted++;
                }
            }

            console.log(`   📊 Done tenant [${tenantId}]: ${upserted} rows upserted, ${skipped} skipped.`);
        }

        console.log('\n🎉 Backfill COMPLETE. All historical leave quotas are now populated.\n');

    } catch (err) {
        console.error('\n❌ Backfill FAILED:', err.message);
        console.error(err);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

run();
