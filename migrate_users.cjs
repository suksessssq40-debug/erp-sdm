const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Manually parse .env (not .env.local per terminal output)
const envPath = path.resolve(__dirname, '.env');
let connString = "postgresql://postgres.euxinsbjfukszxzejbop:082139063266@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres"; // Fallback from checked value

if (fs.existsSync(envPath)) {
  const fileContent = fs.readFileSync(envPath, 'utf8');
  fileContent.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2 && parts[0].trim() === 'DATABASE_URL') {
      let val = parts.slice(1).join('=').trim();
      // Remove quotes if any
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.substring(1, val.length - 1);
      }
      connString = val;
    }
  });
}

const pool = new Pool({
  connectionString: connString,
});

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Starting migration...');
    
    // Check if columns exist
    const res = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users'
    `);
    
    const columns = res.rows.map(r => r.column_name);
    console.log('Existing columns:', columns);

    if (!columns.includes('avatar_url')) {
        console.log('Adding avatar_url...');
        await client.query('ALTER TABLE users ADD COLUMN avatar_url TEXT');
    }
    
    if (!columns.includes('job_title')) {
        console.log('Adding job_title...');
        await client.query('ALTER TABLE users ADD COLUMN job_title TEXT');
    }
    
    if (!columns.includes('bio')) {
        console.log('Adding bio...');
        await client.query('ALTER TABLE users ADD COLUMN bio TEXT');
    }

    console.log('Migration complete!');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    client.release();
    pool.end();
  }
}

migrate();
