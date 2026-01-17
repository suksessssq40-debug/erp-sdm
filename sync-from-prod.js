
const { Client } = require('pg');
require('dotenv').config();

// SOURCE: Production (The one we found strings for)
const PROD_URL = 'postgresql://postgres.opondzzpzxsfucakqwgz:082139063266@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres';
// TARGET: Local (From your .env)
const LOCAL_URL = process.env.DATABASE_URL.replace('pgbouncer=true', ''); // Use direct for sync

async function syncUsers() {
    const prodClient = new Client({ connectionString: PROD_URL });
    const localClient = new Client({ connectionString: LOCAL_URL });

    try {
        await prodClient.connect();
        await localClient.connect();

        console.log("📡 Mengambil data dari PRODUCTION...");
        const users = await prodClient.query('SELECT * FROM users');
        const tenants = await prodClient.query('SELECT * FROM tenants');
        const access = await prodClient.query('SELECT * FROM tenant_access');

        console.log(`📥 Mendapatkan ${users.rowCount} users, ${tenants.rowCount} tenants.`);

        // 1. Sync Tenants first (Relational Parent)
        console.log("⚙️  Syncing Tenants...");
        for (const t of tenants.rows) {
            await localClient.query(`
                INSERT INTO tenants (id, name, description, is_active, created_at, features_json)
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
            `, [t.id, t.name, t.description, t.is_active, t.created_at, t.features_json]);
        }

        // 2. Sync Users
        console.log("⚙️  Syncing Users...");
        for (const u of users.rows) {
            await localClient.query(`
                INSERT INTO users (id, name, username, telegram_id, telegram_username, role, password_hash, device_ids, avatar_url, job_title, bio, is_freelance, created_at, tenant_id)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                ON CONFLICT (id) DO UPDATE SET password_hash = EXCLUDED.password_hash
            `, [u.id, u.name, u.username, u.telegram_id, u.telegram_username, u.role, u.password_hash, JSON.stringify(u.device_ids || []), u.avatar_url, u.job_title, u.bio, u.is_freelance, u.created_at, u.tenant_id]);
        }

        // 3. Sync Tenant Access (The magic link)
        console.log("⚙️  Syncing Permissions (Tenant Access)...");
        for (const a of access.rows) {
            await localClient.query(`
                INSERT INTO tenant_access (id, user_id, tenant_id, role, is_active, created_at)
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (id) DO NOTHING
            `, [a.id, a.user_id, a.tenant_id, a.role, a.is_active, a.created_at]);
        }

        console.log("✅ SINRONISASI BERHASIL! Data lokal sekarang sama dengan production.");

    } catch (e) {
        console.error("❌ ERROR SAAT SYNC:", e.message);
    } finally {
        await prodClient.end();
        await localClient.end();
    }
}

syncUsers();
