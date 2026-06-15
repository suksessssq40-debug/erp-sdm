require('dotenv/config');
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });

async function migrate() {
  console.log('🔄 Adding updated_at column to daily_reports...');
  
  try {
    // Add updated_at column
    await pool.query(`
      ALTER TABLE daily_reports
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ(6);
    `);
    console.log('✅ Column updated_at added');

    // Set updated_at to created_at for existing rows
    await pool.query(`
      UPDATE daily_reports
      SET updated_at = created_at
      WHERE updated_at IS NULL AND created_at IS NOT NULL;
    `);
    console.log('✅ Backfilled updated_at from created_at');

    console.log('🎉 Migration complete!');
  } catch (e) {
    console.error('❌ Migration failed:', e.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
