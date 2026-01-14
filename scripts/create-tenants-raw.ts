
import 'dotenv/config'
import { Pool } from 'pg'

const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL
const pool = new Pool({ connectionString })

async function main() {
  console.log('🏗️ Creating Tenants table manually...');
  try {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS tenants (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMPTZ DEFAULT now()
        );
    `);
    console.log('✅ Table tenants created or exists');

    await pool.query(`
        INSERT INTO tenants (id, name, description) 
        VALUES ('sdm', 'Sukses Digital Media', 'Kantor Utama SDM')
        ON CONFLICT (id) DO NOTHING;
    `);
    console.log('✅ Tenant SDM inserted');

    await pool.query(`
        INSERT INTO tenants (id, name, description) 
        VALUES ('manjada', 'Manjada', 'Unit Bisnis Manjada')
        ON CONFLICT (id) DO NOTHING;
    `);
    console.log('✅ Tenant Manjada inserted');

  } catch (err) {
    console.error('❌ SQL ERROR:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
