
const { pool } = require('./server/db.cjs');

const DEFAULT_ACCOUNTS = [
  { name: 'Mandiri 1', bank: 'Bank Mandiri', desc: 'Rekening Utama' },
  { name: 'Mandiri 2', bank: 'Bank Mandiri', desc: 'Rekening Operasional' },
  { name: 'Mandiri 3', bank: 'Bank Mandiri', desc: 'Rekening Cadangan' },
  { name: 'BCA Syariah', bank: 'BCA Syariah', desc: 'Rekening Syariah' },
  { name: 'Kas Tunai', bank: 'Cash', desc: 'Petty Cash' }
];

async function seed() {
  try {
    console.log("Cleaning financial_accounts...");
    // Optional: Delete existing junk data? 
    // Since we are "implementing everything", let's ensure we have a clean state consistent with constant.ts
    // BUT we must be careful not to break existing transaction references if they use IDs.
    // However, transactions currently use 'account' string (name). So as long as names match, we are good.
    
    // Check if table exists (it does based on previous check)
    // We will upsert based on name to preserve IDs if they exist, or just insert if missing.
    
    for (const acc of DEFAULT_ACCOUNTS) {
      const id = Math.random().toString(36).substr(2, 9); // Simple ID gen
      const now = Date.now();
      
      const res = await pool.query('SELECT id FROM financial_accounts WHERE name = $1', [acc.name]);
      if (res.rows.length === 0) {
        await pool.query(
          `INSERT INTO financial_accounts (id, name, bank_name, description, is_active, created_at) 
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [id, acc.name, acc.bank, acc.desc, true, now]
        );
        console.log(`Created account: ${acc.name}`);
      } else {
        console.log(`Account already exists: ${acc.name}`);
      }
    }
    
    console.log("Seeding complete.");
  } catch (e) {
    console.error(e);
  } finally {
    pool.end();
  }
}

seed();
