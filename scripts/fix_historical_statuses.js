const { Client } = require('pg');

const DB_CONNECTION = 'postgresql://postgres.jhqlrmlqvdatufbuhtsp:082139063266@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres';

async function fixData() {
    const pgClient = new Client({ connectionString: DB_CONNECTION });
    await pgClient.connect();

    try {
        console.log('--- AUDITING & FIXING TRANSACTION STATUSES ---');

        // 1. Update status to UNPAID for all descriptions containing "DP" but NOT "Pelunasan"
        const fixDP = await pgClient.query(`
            UPDATE transactions 
            SET status = 'UNPAID' 
            WHERE tenant_id = 'sdm' 
            AND description ILIKE '%DP%' 
            AND description NOT ILIKE '%Pelunasan%'
            AND (status = 'PAID' OR status IS NULL)
        `);
        console.log(`✅ Fixed ${fixDP.rowCount} transactions containing 'DP' to UNPAID status.`);

        // 2. Ensuring all "Pelunasan" are marked as PAID
        const fixLunas = await pgClient.query(`
            UPDATE transactions 
            SET status = 'PAID' 
            WHERE tenant_id = 'sdm' 
            AND description ILIKE '%Pelunasan%'
            AND (status = 'UNPAID' OR status IS NULL)
        `);
        console.log(`✅ Fixed ${fixLunas.rowCount} transactions containing 'Pelunasan' to PAID status.`);

        console.log('\n--- DATA AUDIT COMPLETED ---');
    } catch (err) {
        console.error('Audit fix error:', err);
    } finally {
        await pgClient.end();
    }
}

fixData();
