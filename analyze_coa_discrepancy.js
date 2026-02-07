
const { Pool } = require('pg');

const PROD_URL = "postgresql://postgres.jhqlrmlqvdatufbuhtsp:082139063266@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres";

const pool = new Pool({
    connectionString: PROD_URL,
    ssl: { rejectUnauthorized: false }
});

async function analyzeCoaLedger() {
    console.log("=== ANALYZE COA LEDGER DISCREPANCY ===");
    const client = await pool.connect();
    try {
        // 1. Get COA info
        const coaRes = await client.query("SELECT * FROM chart_of_accounts WHERE code = '132100' OR name ILIKE '%Piutang Dagang Level Up Gaming%'");
        if (coaRes.rows.length === 0) {
            console.log("COA 132100 not found!");
            return;
        }
        const coa = coaRes.rows[0];
        console.log("COA Found:", coa);

        // 2. Count transactions linked to this COA (by coa_id and by category string)
        const txs = await client.query(`
            SELECT id, date, description, amount, type, account, category, coa_id 
            FROM transactions 
            WHERE coa_id = $1 OR category ILIKE $2
            ORDER BY date ASC
        `, [coa.id, `%${coa.code}%`]);

        console.log(`Found ${txs.rows.length} transactions for this COA.`);

        let sum = 0;
        txs.rows.forEach(t => {
            const amt = parseFloat(t.amount);
            if (t.type === 'IN') sum += amt;
            else sum -= amt;
            console.log(`- [${t.date.toISOString().split('T')[0]}] ${t.description}: ${t.type} ${amt} (Account: ${t.account}, Category: ${t.category})`);
        });

        console.log(`Manual Sum for this COA: ${sum}`);

        // 3. Check the "Summary" calculation for this COA
        const summaryRes = await client.query(`
            SELECT 
                SUM(CASE WHEN type = 'IN' THEN amount ELSE -amount END) as balance
            FROM transactions
            WHERE coa_id = $1 OR category ILIKE $2
        `, [coa.id, `%${coa.code}%`]);
        console.log("DB Aggregated Balance (Transactions):", summaryRes.rows[0].balance);

    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        await pool.end();
    }
}

analyzeCoaLedger();
