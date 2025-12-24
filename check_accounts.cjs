
const { pool } = require('./server/db.cjs');

async function checkAccounts() {
  try {
    const res = await pool.query('SELECT * FROM financial_accounts');
    console.log("Financial Accounts in DB:", res.rows);
    
    // Check columns of financial_accounts
     const schema = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'financial_accounts';
    `);
    console.log("Schema:", schema.rows);

  } catch (e) {
    console.error(e);
  } finally {
    pool.end();
  }
}

checkAccounts();
