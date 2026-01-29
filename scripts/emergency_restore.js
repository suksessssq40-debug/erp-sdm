const { Client } = require('pg');
require('dotenv').config();

// SOURCE_DB = Database yang sekarang sedang aktif (yang datanya sudah terlanjur berubah)
// DEST_DB = Database "Produksi Sebenarnya" (yang tadi saya pindah ke .env di awal sesi)
const PROD_DB = "postgresql://postgres.opondzzpzxsfucakqwgz:082139063266@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres";
const LOCAL_DB = "postgresql://postgres.euxinsbjfukszxzejbop:082139063266@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres";

async function restore() {
    const prod = new Client({ connectionString: PROD_DB });
    const local = new Client({ connectionString: LOCAL_DB });

    try {
        await prod.connect();
        await local.connect();
        console.log('Restoring data from Real Production to Local...');

        const TABLES = [
            'tenants', 'users', 'tenant_access', 'business_units',
            'chart_of_accounts', 'financial_accounts', 'shifts',
            'transactions', 'attendance', 'leave_requests',
            'payroll_records', 'salary_configs', 'settings',
            'daily_reports', 'system_logs', 'projects',
            'chat_rooms', 'chat_members', 'chat_messages', 'transaction_categories'
        ];

        for (const table of TABLES) {
            console.log(`- Restoring ${table}...`);
            const res = await prod.query(`SELECT * FROM "${table}"`);

            await local.query(`TRUNCATE TABLE "${table}" RESTART IDENTITY CASCADE`);

            if (res.rows.length > 0) {
                const columns = res.fields.map(f => `"${f.name}"`).join(', ');
                const placeholders = res.fields.map((_, i) => `$${i + 1}`).join(', ');
                const insertQuery = `INSERT INTO "${table}" (${columns}) VALUES (${placeholders})`;

                for (const row of res.rows) {
                    const values = res.fields.map(f => {
                        const val = row[f.name];
                        if (val !== null && typeof val === 'object' && !(val instanceof Date)) {
                            return JSON.stringify(val);
                        }
                        return val;
                    });
                    await local.query(insertQuery, values);
                }
            }
        }
        console.log('\n✅ RESTORE BERHASIL! Database Lokal sudah kembali ke kondisi awal Produksi.');
    } catch (err) {
        console.error('❌ RESTORE GAGAL:', err);
    } finally {
        await prod.end();
        await local.end();
    }
}

restore();
