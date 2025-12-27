const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Migrating settings table...');
    
    // Add daily_recap_time
    await client.query(`
      ALTER TABLE settings 
      ADD COLUMN IF NOT EXISTS daily_recap_time VARCHAR(10) DEFAULT '18:00';
    `);
    
    // Add daily_recap_content
    await client.query(`
      ALTER TABLE settings 
      ADD COLUMN IF NOT EXISTS daily_recap_content JSONB DEFAULT '[]';
    `);
    
    console.log('Migration successful: Added daily_recap_time and daily_recap_content columns.');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    client.release();
    pool.end();
  }
}

migrate();
