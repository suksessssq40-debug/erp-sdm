const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres.opondzzpzxsfucakqwgz:082139063266@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres'
});

async function run() {
  try {
    await client.connect();
    console.log('--- START PRODUCTION MIGRATION ---');

    // 1. Create Shifts Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS "shifts" (
        "id" TEXT NOT NULL,
        "tenant_id" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "shift_start_time" TEXT NOT NULL,
        "shift_end_time" TEXT NOT NULL,
        "is_overnight" BOOLEAN NOT NULL DEFAULT false,
        CONSTRAINT "shifts_pkey" PRIMARY KEY ("id")
      );
    `);
    console.log('Table "shifts" verified/created.');

    // 2. Add columns to "tenants"
    await client.query('ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "work_strategy" TEXT DEFAULT \'FIXED\';');
    await client.query('ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "radius_tolerance" INTEGER DEFAULT 100;');
    await client.query('ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "late_grace_period" INTEGER DEFAULT 15;');
    console.log('Columns added to "tenants".');

    // 3. Add columns to "attendance"
    await client.query('ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "shift_id" TEXT;');
    await client.query('ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "work_duration" INTEGER;');
    console.log('Columns added to "attendance".');

    // 4. Add constraints
    try {
        await client.query('ALTER TABLE "shifts" ADD CONSTRAINT "shifts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;');
    } catch(e) { console.log('Constraint shifts_tenant_id_fkey might already exist, skipping...'); }

    try {
        await client.query('ALTER TABLE "attendance" ADD CONSTRAINT "attendance_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;');
    } catch(e) { console.log('Constraint attendance_shift_id_fkey might already exist, skipping...'); }

    console.log('--- MIGRATION COMPLETED SUCCESSFULLY ---');
    await client.end();
  } catch (err) {
    console.error('Migration failed', err);
    process.exit(1);
  }
}

run();
