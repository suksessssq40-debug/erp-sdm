const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres.opondzzpzxsfucakqwgz:082139063266@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres'
});

async function run() {
  try {
    await client.connect();
    
    console.log('--- START AUDIT PROD ---');
    
    // Check tables
    const tablesRes = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
    const tables = tablesRes.rows.map(r => r.table_name);
    console.log('Tables:', tables.join(', '));
    
    // Check Tenants
    const tenantColsRes = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'tenants'");
    console.log('Tenants Columns:', tenantColsRes.rows.map(r => r.column_name).join(', '));
    
    // Check Attendance
    const attendanceColsRes = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'attendance'");
    console.log('Attendance Columns:', attendanceColsRes.rows.map(r => r.column_name).join(', '));
    
    await client.end();
  } catch (err) {
    console.error('Audit failed', err);
    process.exit(1);
  }
}

run();
