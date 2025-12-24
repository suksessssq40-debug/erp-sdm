
const { pool } = require('./server/db.cjs');

async function checkSchema() {
  try {
    const res = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'transactions';
    `);
    console.log("Transactions Table Schema:", res.rows);
    
    const countRes = await pool.query('SELECT count(*) FROM transactions');
    console.log("Transaction Count:", countRes.rows[0].count);

    // Check if there are other related tables
    const tableRes = await pool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public';
    `);
    console.log("Tables:", tableRes.rows.map(r => r.table_name));

  } catch (e) {
    console.error(e);
  } finally {
    pool.end();
  }
}

checkSchema();
