
const { Pool } = require('pg');

const PROD_URL = 'postgresql://postgres.jhqlrmlqvdatufbuhtsp:082139063266@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres';
const LOCAL_URL = 'postgresql://postgres.euxinsbjfukszxzejbop:082139063266@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres';

const prodPool = new Pool({ connectionString: PROD_URL, ssl: { rejectUnauthorized: false } });
const localPool = new Pool({ connectionString: LOCAL_URL, ssl: { rejectUnauthorized: false } });

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
    'system_logs'
];

async function sync() {
    console.log('🚀 Memulai Sinkronisasi Database Prod -> Lokal...');
    console.log('--------------------------------------------------');

    try {
        // 1. Matikan Trigger di Lokal (agar tidak ada error foreign key saat proses)
        console.log('⏳ Menonaktifkan trigger & constraint di database lokal...');
        await localPool.query('SET session_replication_role = \'replica\';');

        for (const table of TABLES) {
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
                const chunkSize = 40; // Smaller chunks for large JSON safely

                for (let i = 0; i < prodData.rows.length; i += chunkSize) {
                    const chunk = prodData.rows.slice(i, i + chunkSize);

                    const valueRows = chunk.map((row, idx) => {
                        return `(${columns.map((_, colIdx) => `$${idx * columns.length + colIdx + 1}`).join(',')})`;
                    });

                    const values = chunk.flatMap(row => columns.map(col => {
                        const val = row[col];
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

        // 2. Aktifkan kembali Trigger
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
