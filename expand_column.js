
const { Client } = require('pg');

const connectionString = 'postgresql://postgres.opondzzpzxsfucakqwgz:082139063266@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres';

async function alterColumn() {
  const client = new Client({ connectionString });
  console.log("Expanding 'date' column in 'attendance' to 50 chars...");
  
  try {
    await client.connect();
    // Gunakan ALTER TABLE biasa, lebih aman dan cepat daripada Prisma Migrate yang mau reset DB
    await client.query(`ALTER TABLE attendance ALTER COLUMN date TYPE VARCHAR(50)`);
    console.log("✅ Column expanded successfully.");
  } catch(e) { 
    console.error("❌ Failed to alter table:", e.message); 
  } finally { 
    await client.end(); 
  }
}

alterColumn();
