import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// Force dynamic to ensure it runs every time it's called
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  // Security Check: Optional protection (uncomment to require secret key)
  // const { searchParams } = new URL(request.url);
  // if (searchParams.get('key') !== process.env.MIGRATION_SECRET) {
  //    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // }

  const client = await pool.connect();
  const summary = {
    step1_schema: 'skipped',
    step2_accounts_found: 0,
    step3_transactions_found: 0,
    step4_linked: 0,
    step4_failed: 0,
    errors: [] as string[]
  };

  try {
    // 0. Ensure Column Exists (Defensive Schema Fix)
    // This SQL block is "Safe Idempotent", meaning it won't break if run multiple times
    try {
        await client.query(`
        DO $$ 
        BEGIN 
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='account_id') THEN 
            ALTER TABLE transactions ADD COLUMN account_id VARCHAR(50);
            CREATE INDEX IF NOT EXISTS idx_trans_account ON transactions(account_id);
            END IF;
        END $$;
        `);
        summary.step1_schema = 'success';
    } catch (e: any) {
        summary.step1_schema = 'error: ' + e.message;
        summary.errors.push(e.message);
    }
    
    // 1. Get All Financial Accounts
    const accounts = await client.query('SELECT id, name FROM financial_accounts');
    summary.step2_accounts_found = accounts.rows.length;

    const accountMap: Record<string, string> = {};
    accounts.rows.forEach(acc => {
      accountMap[acc.name] = acc.id; 
      accountMap[acc.name.toLowerCase()] = acc.id;
    });
    
    // 2. Get Transactions without account_id
    // Only target those that have a legacy string name but NO id yet
    const txs = await client.query(`
        SELECT id, account, description 
        FROM transactions 
        WHERE account_id IS NULL AND account IS NOT NULL
    `);
    summary.step3_transactions_found = txs.rows.length;
    
    let updated = 0;
    let failed = 0;
    
    // 3. Process Linking
    for (const tx of txs.rows) {
      if (!tx.account) continue;
      
      const targetId = accountMap[tx.account] || accountMap[tx.account.toLowerCase()];
      
      if (targetId) {
        await client.query(`UPDATE transactions SET account_id = $1 WHERE id = $2`, [targetId, tx.id]);
        updated++;
      } else {
        failed++;
      }
    }
    
    summary.step4_linked = updated;
    summary.step4_linked = failed;

    return NextResponse.json({
        message: 'Migration completed',
        details: summary
    });

  } catch (e: any) {
    return NextResponse.json({ 
        error: 'Migration Fatal Error', 
        details: e.message 
    }, { status: 500 });
  } finally {
    client.release();
  }
}
