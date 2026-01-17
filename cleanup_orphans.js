require('dotenv/config');
const { Pool } = require('pg');

const PROD_URL = 'postgresql://postgres.opondzzpzxsfucakqwgz:082139063266@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres';
const pool = new Pool({ connectionString: PROD_URL });

async function cleanup() {
  try {
    console.log("--- CLEANING ORPHANED ATTENDANCE RECORDS ---");
    
    // 1. Delete records with NULL userId
    const resNull = await pool.query(`DELETE FROM attendance WHERE user_id IS NULL`);
    console.log(`Deleted ${resNull.rowCount} records with NULL userId.`);

    // 2. Delete records where user_id does not exist in users table
    const resOrphans = await pool.query(`
        DELETE FROM attendance 
        WHERE user_id IS NOT NULL 
        AND user_id NOT IN (SELECT id FROM users)
    `);
    console.log(`Deleted ${resOrphans.rowCount} records referencing non-existent users.`);

  } catch (e) {
    console.error("Cleanup failed:", e);
  } finally {
    await pool.end();
  }
}

cleanup();
