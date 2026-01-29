const { createClient } = require('@supabase/supabase-js');
const { Client } = require('pg');

// KONFIGURASI SERVER LAMA (Sumber Foto)
const OLD_SUPABASE_URL = 'https://opondzzpzxsfucakqwgz.supabase.co';
const OLD_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9wb25kenpwenhzZnVjYWtxd2d6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjE3ODE1NSwiZXhwIjoyMDgxNzU0MTU1fQ.RsVCNytdtMOORlfmrzBGvEfUEt3MTV6RlfJnHP5XIYU';

// KONFIGURASI SERVER BARU (Target Foto) - Mengacu pada .env yang aktif
const NEW_SUPABASE_URL = 'https://euxinsbjfukszxzejbop.supabase.co';
const NEW_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1eGluc2JqZnVrc3p4emVqYm9wIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjIxNTQ4MSwiZXhwIjoyMDgxNzkxNDgxfQ.SwII-fVGphfVjtpZT03m2WHOE8tHEjO6j5LjYoB2LKU';

// DATABASE TARGET (Untuk update Link)
const DB_CONNECTION = 'postgresql://postgres.euxinsbjfukszxzejbop:082139063266@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres';

const oldSupabase = createClient(OLD_SUPABASE_URL, OLD_SUPABASE_KEY);
const newSupabase = createClient(NEW_SUPABASE_URL, NEW_SUPABASE_KEY);

async function migrate() {
    console.log('--- STARTING STORAGE MIGRATION ---');

    // 1. List files in 'uploads' old project
    const { data: files, error: listError } = await oldSupabase.storage.from('uploads').list('', { limit: 500 });
    if (listError) {
        console.error('Error listing old files:', listError);
        return;
    }

    console.log(`Found ${files.length} files to migrate.`);

    for (const file of files) {
        if (file.name === '.emptyFolderPlaceholder') continue;

        console.log(`Migrating: ${file.name}...`);

        // Download from old
        const { data: blob, error: dlError } = await oldSupabase.storage.from('uploads').download(file.name);
        if (dlError) {
            console.error(`Failed download ${file.name}:`, dlError);
            continue;
        }

        // Upload to new
        const { error: ulError } = await newSupabase.storage.from('uploads').upload(file.name, blob, {
            upsert: true,
            contentType: 'image/jpeg'
        });

        if (ulError) {
            console.error(`Failed upload ${file.name}:`, ulError);
        } else {
            console.log(`✅ Success: ${file.name}`);
        }
    }

    // 2. Update Database URLs
    console.log('\n--- UPDATING DATABASE LINKS ---');
    const pgClient = new Client({ connectionString: DB_CONNECTION });
    await pgClient.connect();

    try {
        const oldRef = 'opondzzpzxsfucakqwgz';
        const newRef = 'euxinsbjfukszxzejbop';

        const r1 = await pgClient.query(`UPDATE attendance SET selfie_url = REPLACE(selfie_url, '${oldRef}', '${newRef}') WHERE selfie_url LIKE '%${oldRef}%'`);
        const r2 = await pgClient.query(`UPDATE attendance SET check_out_selfie_url = REPLACE(check_out_selfie_url, '${oldRef}', '${newRef}') WHERE check_out_selfie_url LIKE '%${oldRef}%'`);
        const r3 = await pgClient.query(`UPDATE leave_requests SET attachment_url = REPLACE(attachment_url, '${oldRef}', '${newRef}') WHERE attachment_url LIKE '%${oldRef}%'`);
        const r4 = await pgClient.query(`UPDATE transactions SET image_url = REPLACE(image_url, '${oldRef}', '${newRef}') WHERE image_url LIKE '%${oldRef}%'`);

        console.log(`Database updated: ${r1.rowCount + r2.rowCount + r3.rowCount + r4.rowCount} links fixed.`);
    } catch (err) {
        console.error('Database update error:', err);
    } finally {
        await pgClient.end();
    }

    console.log('\n✅ MIGRATION COMPLETED!');
}

migrate();
