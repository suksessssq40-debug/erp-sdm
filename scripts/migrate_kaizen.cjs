const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Manually parse .env from project root
const envPath = path.resolve(__dirname, '..', '.env');
let connString = '';

if (fs.existsSync(envPath)) {
  const fileContent = fs.readFileSync(envPath, 'utf8');
  fileContent.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2 && parts[0].trim() === 'DATABASE_URL') {
      let val = parts.slice(1).join('=').trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.substring(1, val.length - 1);
      }
      connString = val;
    }
  });
}

if (!connString) {
  console.error('DATABASE_URL not found in .env');
  process.exit(1);
}

const pool = new Pool({
  connectionString: connString,
  ssl: { rejectUnauthorized: false }
});

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Starting Kaizen migration...');

    // 1. Add columns to users table
    const colCheck = await client.query(`
      SELECT column_name FROM information_schema.columns WHERE table_name = 'users'
    `);
    const columns = colCheck.rows.map(r => r.column_name);

    if (!columns.includes('is_kaizen_master')) {
      console.log('Adding is_kaizen_master column...');
      await client.query('ALTER TABLE users ADD COLUMN is_kaizen_master BOOLEAN DEFAULT FALSE');
    } else {
      console.log('is_kaizen_master already exists.');
    }

    if (!columns.includes('kaizen_points')) {
      console.log('Adding kaizen_points column...');
      await client.query('ALTER TABLE users ADD COLUMN kaizen_points INT DEFAULT 100');
    } else {
      console.log('kaizen_points already exists.');
    }

    if (!columns.includes('kaizen_points_reset_at')) {
      console.log('Adding kaizen_points_reset_at column...');
      await client.query('ALTER TABLE users ADD COLUMN kaizen_points_reset_at TIMESTAMPTZ(6)');
    } else {
      console.log('kaizen_points_reset_at already exists.');
    }

    // 2. Set default values for existing users
    console.log('Setting default kaizen points for existing users...');
    await client.query(`
      UPDATE users SET kaizen_points = 100 WHERE kaizen_points IS NULL;
    `);
    await client.query(`
      UPDATE users SET is_kaizen_master = FALSE WHERE is_kaizen_master IS NULL;
    `);

    // 3. Create kaizen_deductions table
    console.log('Creating kaizen_deductions table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS kaizen_deductions (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        user_id TEXT NOT NULL REFERENCES users(id),
        deducted_by TEXT NOT NULL,
        amount INT NOT NULL,
        category TEXT NOT NULL,
        reason TEXT,
        created_at TIMESTAMPTZ(6) DEFAULT NOW()
      );
    `);

    // 4. Create index for faster lookups
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_kaizen_deductions_user_id ON kaizen_deductions(user_id);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_kaizen_deductions_created_at ON kaizen_deductions(created_at DESC);
    `);

    console.log('Kaizen migration complete!');
  } catch (err) {
    console.error('Kaizen migration failed:', err);
  } finally {
    client.release();
    pool.end();
  }
}

migrate();
