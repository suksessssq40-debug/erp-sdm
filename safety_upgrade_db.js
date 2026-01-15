
const { Client } = require('pg');

const connectionString = 'postgresql://postgres.opondzzpzxsfucakqwgz:082139063266@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres';

async function upgradeDatabase() {
  const client = new Client({ connectionString });
  console.log("🚀 Starting SAFE Database Upgrade...");
  
  try {
    await client.connect();

    // 1. Expand DailyReport Date Column (Prevent Crash)
    console.log("1. Expanding daily_reports.date to VARCHAR(50)...");
    await client.query(`ALTER TABLE daily_reports ALTER COLUMN date TYPE VARCHAR(50)`);
    console.log("✅ Done.");

    // 2. Add Indexes for Performance
    console.log("2. Creating Indexes...");
    
    // Attendance Index
    await client.query(`CREATE INDEX IF NOT EXISTS idx_attendance_tenant_date ON attendance (tenant_id, created_at DESC)`);
    console.log("   - idx_attendance_tenant_date: ✅");

    // DailyReport Index
    await client.query(`CREATE INDEX IF NOT EXISTS idx_daily_reports_tenant_date ON daily_reports (tenant_id, created_at DESC)`);
    console.log("   - idx_daily_reports_tenant_date: ✅");
    
    // Transactions Index
    await client.query(`CREATE INDEX IF NOT EXISTS idx_transactions_tenant_date ON transactions (tenant_id, date DESC)`);
    console.log("   - idx_transactions_tenant_date: ✅");

    console.log("🎉 All upgrades applied successfully without data loss.");

  } catch(e) { 
    console.error("❌ Error:", e.message); 
  } finally { 
    await client.end(); 
  }
}

upgradeDatabase();
