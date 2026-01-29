const { Client } = require('pg');

const DB_CONNECTION = 'postgresql://postgres.jhqlrmlqvdatufbuhtsp:082139063266@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres';

async function recalculate() {
    const pgClient = new Client({ connectionString: DB_CONNECTION });
    await pgClient.connect();

    try {
        console.log('Starting Auto-Healing Recalculation on Production...');

        // Get all accounts
        const accountsRes = await pgClient.query('SELECT id, name FROM financial_accounts');
        const accounts = accountsRes.rows;

        for (const acc of accounts) {
            // Calculate sum of all transactions associated with this account (PAID or UNPAID)
            const res = await pgClient.query(
                "SELECT SUM(CASE WHEN type = 'IN' THEN amount ELSE -amount END) as total FROM transactions WHERE account_id = $1",
                [acc.id]
            );

            const newBalance = Number(res.rows[0].total || 0);

            // Update Account Balance
            await pgClient.query(
                'UPDATE financial_accounts SET balance = $1 WHERE id = $2',
                [newBalance, acc.id]
            );

            console.log(`✅ Account ${acc.name} synchronized to: ${newBalance}`);
        }

        console.log('\n--- ALL BALANCES SYNCHRONIZED ---');
    } catch (err) {
        console.error('Recalculation error:', err);
    } finally {
        await pgClient.end();
    }
}

recalculate();
