require('dotenv/config');
const { Pool } = require('pg');

const PROD_URL = 'postgresql://postgres.opondzzpzxsfucakqwgz:082139063266@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres';
const pool = new Pool({ connectionString: PROD_URL });

async function hardening() {
  try {
    console.log("--- FINAL PRODUCTION HARDENING ---");
    
    // 1. Ensure all users have a name (default to username)
    const resNames = await pool.query(`
        UPDATE users 
        SET name = username 
        WHERE name IS NULL OR name = ''
    `);
    console.log(`Updated ${resNames.rowCount} users with missing names.`);

    // 2. Ensure all tenants have featuresJson set to at least '[]'
    const resFeatures = await pool.query(`
        UPDATE tenants 
        SET features_json = '[]' 
        WHERE features_json IS NULL
    `);
    console.log(`Updated ${resFeatures.rowCount} tenants with missing features_json.`);

    console.log("Hardening complete.");
  } catch (e) {
    console.error("Hardening failed:", e);
  } finally {
    await pool.end();
  }
}

hardening();
