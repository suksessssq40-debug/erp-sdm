/**
 * scripts/cleanup_system_logs.js
 *
 * Maintenance script: prune system_logs older than N days (default: 30).
 *
 * Usage:
 *   node scripts/cleanup_system_logs.js          → deletes logs > 30 days old
 *   node scripts/cleanup_system_logs.js 60       → deletes logs > 60 days old
 *
 * Safe to run anytime. Recommended: weekly via cron or manually.
 */

'use strict';

const { Pool } = require('pg');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const RETENTION_DAYS = parseInt(process.argv[2] || '30', 10);

if (isNaN(RETENTION_DAYS) || RETENTION_DAYS < 1) {
    console.error('❌ Invalid retention days. Usage: node cleanup_system_logs.js [days]');
    process.exit(1);
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('supabase') ? { rejectUnauthorized: false } : false,
});
pool.on('error', (err) => console.warn('[pool idle error]', err.message));

async function run() {
    const cutoffMs = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;

    console.log(`\n🧹 system_logs Cleanup`);
    console.log(`   Retention: ${RETENTION_DAYS} days`);
    console.log(`   Deleting logs with timestamp < ${new Date(cutoffMs).toISOString()}\n`);

    const client = await pool.connect();
    try {
        // Count first so we can report
        const countRes = await client.query(
            `SELECT COUNT(*) AS n FROM system_logs WHERE timestamp < $1`,
            [cutoffMs]
        );
        const toDelete = Number(countRes.rows[0].n);

        if (toDelete === 0) {
            console.log('✅ Nothing to delete — system_logs is already clean.');
            return;
        }

        console.log(`🗑️  Found ${toDelete} rows to delete...`);

        // Delete in batches of 2000 to avoid long lock hold times
        let totalDeleted = 0;
        while (true) {
            const res = await client.query(`
                DELETE FROM system_logs
                WHERE id IN (
                    SELECT id FROM system_logs
                    WHERE timestamp < $1
                    LIMIT 2000
                )
            `, [cutoffMs]);

            const deletedBatch = res.rowCount ?? 0;
            totalDeleted += deletedBatch;
            process.stdout.write(`\r   Deleted ${totalDeleted} / ${toDelete} rows...`);

            if (deletedBatch === 0) break;
        }

        console.log(`\n✅ Done! ${totalDeleted} rows deleted from system_logs.`);
        console.log(`   Remaining rows: available for audit (last ${RETENTION_DAYS} days).`);

    } catch (err) {
        console.error('\n❌ Cleanup failed:', err.message);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

run();
