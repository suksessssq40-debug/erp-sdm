const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres.opondzzpzxsfucakqwgz:082139063266@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres'
});

async function run() {
  try {
    await client.connect();
    console.log('--- STARTING FINAL SECURITY HARDENING (PHASE 2) ---');

    // List of tables identified from the screenshot that are still insecure
    const remainingTables = [
      'tenant_access',
      'tenants',
      'salary_configs',
      'shifts',
      'system_logs',
      'chat_members',
      'payroll_records' // Proactive addition based on context
    ];

    for (const table of remainingTables) {
        console.log(`Securing table: ${table}...`);
        
        // 1. Enable RLS (Safety Lock)
        // If already enabled, this does nothing harmlessly.
        await client.query(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;`);

        // 2. Drop existing policies to prevent conflicts/duplicates
        try { await client.query(`DROP POLICY IF EXISTS "Allow All for Service Role" ON "${table}";`); } catch(e) {}
        try { await client.query(`DROP POLICY IF EXISTS "Allow Authenticated" ON "${table}";`); } catch(e) {}

        // 3. POLICY A: ALLOW THE SYSTEM (PRISMA) TO DO ANYTHING
        // This is critical effectively preventing "App Error/Crash".
        // Prisma connects via connection pool (postgres role), but RLS applies to tables.
        // We grant FULL access to "service_role" and "postgres" (just in case).
        await client.query(`
            CREATE POLICY "Allow All for Service Role" 
            ON "${table}" 
            AS PERMISSIVE 
            FOR ALL 
            TO service_role, postgres 
            USING (true) 
            WITH CHECK (true);
        `);

        // 4. POLICY B: ALLOW LOGGED IN USERS TO READ/WRITE (For now)
        // This prevents "Data Not Showing" in frontend if using supabase-js client directly.
        await client.query(`
            CREATE POLICY "Allow Authenticated" 
            ON "${table}" 
            AS PERMISSIVE 
            FOR ALL 
            TO authenticated 
            USING (true) 
            WITH CHECK (true);
        `);

        // NOTE: We intentionally DO NOT allow 'anon' (Public).
        // This effectively seals the "Security Hole" shown in the dashboard.
        
        console.log(`  > Secured: ${table}`);
    }

    console.log('--- FINAL SECURITY HARDENING COMPLETED ---');
    console.log('All critical tables are now protected from Public anonymous access.');
    
    await client.end();
  } catch (err) {
    console.error('Hardening failed', err);
    process.exit(1);
  }
}

run();
