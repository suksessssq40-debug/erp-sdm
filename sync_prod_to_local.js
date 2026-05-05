
const { Pool } = require('pg');

const PROD_URL = 'postgresql://postgres.jhqlrmlqvdatufbuhtsp:082139063266@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres';
const LOCAL_URL = 'postgresql://postgres.euxinsbjfukszxzejbop:082139063266@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres';

const prodPool = new Pool({ connectionString: PROD_URL, ssl: { rejectUnauthorized: false } });
const localPool = new Pool({ connectionString: LOCAL_URL, ssl: { rejectUnauthorized: false } });

// Mencegah crash jika Supabase mematikan koneksi idle
prodPool.on('error', (err) => console.warn('Prod pool idle error:', err.message));
localPool.on('error', (err) => console.warn('Local pool idle error:', err.message));

// Tabel yang sengaja di-SKIP dari sinkronisasi:
//   system_logs → terlalu besar (23k+ baris), menyebabkan timeout pooler Supabase.
//                 Log tidak dibutuhkan secara lokal; gunakan prisma studio untuk debug.
const SKIP_TABLES = new Set(['system_logs']);

const TABLES = [
    'tenants', // Critical first
    'users',
    'business_units',
    'financial_accounts',
    'chart_of_accounts',
    'transaction_categories',
    'transactions',
    'shifts',
    'attendance',
    'leave_requests',
    'projects',
    'daily_reports',
    'salary_configs',
    'payroll_records',
    'tenant_access',
    'settings',
    'chat_rooms',
    'chat_members',
    'chat_messages',
    'push_subscriptions',
    'leave_quotas',    // NEW: Leave quota tracking
    // system_logs  ← INTENTIONALLY EXCLUDED (see SKIP_TABLES above)
];

async function sync() {
    console.log('🚀 Memulai Sinkronisasi Database Prod -> Lokal...');
    console.log('--------------------------------------------------');

    try {
        // 1. Matikan Trigger di Lokal (agar tidak ada error foreign key saat proses)
        console.log('⏳ Menonaktifkan trigger & constraint di database lokal...');
        await localPool.query('SET session_replication_role = \'replica\';');

        for (const table of TABLES) {
            if (SKIP_TABLES.has(table)) {
                console.log(`\n⏭️  Skip tabel: [${table}] (excluded)`); continue;
            }
            console.log(`\n📦 Memproses tabel: [${table}]`);

            // A. Ambil Data dari Production
            const prodData = await prodPool.query(`SELECT * FROM "${table}"`);
            console.log(`   ✅ Prod: ${prodData.rows.length} baris ditemukan.`);

            // B. Kosongkan Tabel Lokal
            await localPool.query(`TRUNCATE TABLE "${table}" CASCADE`);
            console.log(`   🗑️ Lokal: Tabel dikosongkan.`);

            // C. Insert Data ke Lokal
            if (prodData.rows.length > 0) {
                const columns = Object.keys(prodData.rows[0]);
                const chunkSize = 50; // Balanced chunk size — fast but safe for Supabase pooler

                for (let i = 0; i < prodData.rows.length; i += chunkSize) {
                    const chunk = prodData.rows.slice(i, i + chunkSize);

                    const valueRows = chunk.map((row, idx) => {
                        return `(${columns.map((_, colIdx) => `$${idx * columns.length + colIdx + 1}`).join(',')})`;
                    });

                    const values = chunk.flatMap(row => columns.map(col => {
                        let val = row[col];
                        
                        // CRITICAL: Handle BigInt to Date conversion for leave_requests
                        // Prod uses BigInt timestamps, Local uses Timestamptz
                        if (table === 'leave_requests' && (col === 'created_at' || col === 'action_at') && val !== null) {
                            if (typeof val === 'string' || typeof val === 'number' || typeof val === 'bigint') {
                                // Supabase BigInt usually comes as string in JS pg driver
                                val = new Date(Number(val));
                            }
                        }

                        // CRITICAL: Handle JSONB and objects
                        if (val !== null && typeof val === 'object' && !(val instanceof Date)) {
                            return JSON.stringify(val);
                        }
                        return val;
                    }));

                    const chunkQuery = {
                        text: `INSERT INTO "${table}" (${columns.map(c => `"${c}"`).join(',')}) VALUES ${valueRows.join(',')}`,
                        values: values
                    };

                    await localPool.query(chunkQuery);
                    process.stdout.write(`   📤 Mengirim chunk ${Math.floor(i / chunkSize) + 1}... (${Math.min(i + chunkSize, prodData.rows.length)}/${prodData.rows.length}) \r`);
                }
                console.log(`\n   ✨ Berhasil masuk ke lokal.`);
            } else {
                console.log(`   ℹ️ Skip (Data kosong).`);
            }
        }

        // 2. Reset Sequence untuk tabel yang menggunakan auto-increment (settings)
        console.log('🔄 Mereset sequence auto-increment...');
        await localPool.query("SELECT setval(pg_get_serial_sequence('settings', 'id'), coalesce(max(id), 1)) FROM settings;");

        // 3. Aktifkan kembali Trigger
        await localPool.query('SET session_replication_role = \'origin\';');
        console.log('\n--------------------------------------------------');
        console.log('✅ SINKRONISASI SELESAI!');
        console.log('Semua data dari Production telah disalin ke Lokal.');

    } catch (err) {
        console.error('\n❌ ERROR SAAT SINKRONISASI:', err);
        // Pastikan trigger kembali ke origin jika error
        await localPool.query('SET session_replication_role = \'origin\';').catch(() => { });
    } finally {
        await prodPool.end();
        await localPool.end();
    }
}

sync();
