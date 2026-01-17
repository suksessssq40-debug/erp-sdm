
const { Client } = require('pg');

async function checkUsers() {
  const client = new Client({
    connectionString: "postgresql://postgres.euxinsbjfukszxzejbop:082139063266@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres"
  });

  try {
    await client.connect();
    console.log("Connected to database successfully.");
    
    const res = await client.query('SELECT id, username, role, tenant_id FROM users LIMIT 10');
    console.log("User accounts found in DB:");
    console.table(res.rows);

    const tenants = await client.query('SELECT id, name FROM tenants LIMIT 10');
    console.log("Tenants found in DB:");
    console.table(tenants.rows);
    
    const tables = await client.query("SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'");
    console.log("Total tables in public schema:", tables.rows[0].count);

    const totalUsers = await client.query('SELECT count(*) FROM users');
    console.log("Total users in table:", totalUsers.rows[0].count);

  } catch (err) {
    console.error("Database connection error:", err.message);
  } finally {
    await client.end();
  }
}

checkUsers();
