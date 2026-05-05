const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function check() {
  const client = await pool.connect();
  try {
    const r = await client.query(
      `SELECT id, user_id, date, time_in, time_out, is_late, created_at
       FROM attendance WHERE user_id = $1
       ORDER BY created_at DESC LIMIT 10`,
      ['92hby73jq']
    );
    console.log('\n=== ATTENDANCE RECORDS: 92hby73jq (MOCHAMMAD RIZKY) ===');
    console.log(`Total records found: ${r.rows.length}`);
    r.rows.forEach((row, i) => {
      console.log(`\n[${i + 1}]`, JSON.stringify(row, null, 2));
    });

    // Also check today's date in Jakarta timezone
    const jakartaNow = new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' });
    console.log('\n=== DEBUG DATE ===');
    console.log('UTC Now:', new Date().toISOString());
    console.log('Jakarta Now (locale string):', jakartaNow);
    
    // What todayStr in browser would compute
    const jakartaTime = new Date(jakartaNow);
    const todayStr = jakartaTime.toISOString().split('T')[0];
    console.log('todayStr (as computed by browser getTodayJakarta):', todayStr);
    
    // Also correct method
    const correctToday = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
    console.log('Correct todayStr (en-CA):', correctToday);

  } finally {
    client.release();
    await pool.end();
  }
}

check().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
