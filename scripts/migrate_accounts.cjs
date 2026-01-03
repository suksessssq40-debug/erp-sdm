const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function migrate() {
  console.log('🚀 Starting Account Migration...');
  const client = await pool.connect();
  
  try {
    // 0. Ensure Column Exists (Manual Schema Fix/Migration)
    console.log('🛠️ Checking Schema...');
    await client.query(`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='account_id') THEN 
           ALTER TABLE transactions ADD COLUMN account_id VARCHAR(50);
           CREATE INDEX idx_trans_account ON transactions(account_id);
           RAISE NOTICE 'Added account_id column';
        END IF;
      END $$;
    `);
    
    // 1. Get All Financial Accounts
    const accounts = await client.query('SELECT id, name FROM financial_accounts');
    const accountMap = {};
    accounts.rows.forEach(acc => {
      accountMap[acc.name] = acc.id; 
      accountMap[acc.name.toLowerCase()] = acc.id;
    });
    
    console.log(`✅ Loaded ${accounts.rows.length} Financial Accounts`);
    
    // 2. Get Transactions without account_id
    const txs = await client.query(`
        SELECT id, account, description 
        FROM transactions 
        WHERE account_id IS NULL AND account IS NOT NULL
    `);
    
    console.log(`🔍 Found ${txs.rows.length} transactions to link...`);
    
    let updated = 0;
    let failed = 0;
    
    for (const tx of txs.rows) {
      if (!tx.account) continue;
      
      const targetId = accountMap[tx.account] || accountMap[tx.account.toLowerCase()];
      
      if (targetId) {
        await client.query(`UPDATE transactions SET account_id = $1 WHERE id = $2`, [targetId, tx.id]);
        updated++;
      } else {
        // console.warn(`⚠️ No matching account found for: "${tx.account}" (Tx: ${tx.description})`);
        failed++;
      }
    }
    
    console.log('-----------------------------------');
    console.log(`🎉 Migration Complete!`);
    console.log(`Linked: ${updated} transactions`);
    console.log(`Unlinked: ${failed} transactions (Check names)`);
    
  } catch (e) {
    console.error('Migration Failed:', e);
  } finally {
    client.release();
    pool.end();
  }
}

migrate();
