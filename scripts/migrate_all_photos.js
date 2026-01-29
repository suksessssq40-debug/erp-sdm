const { createClient } = require('@supabase/supabase-js');
const { Client } = require('pg');

// KONFIGURASI SERVER LAMA (Sumber Foto)
const OLD_SUPABASE_URL = 'https://opondzzpzxsfucakqwgz.supabase.co';
const OLD_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9wb25kenpwenhzZnVjYWtxd2d6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjE3ODE1NSwiZXhwIjoyMDgxNzU0MTU1fQ.RsVCNytdtMOORlfmrzBGvEfUEt3MTV6RlfJnHP5XIYU';

// KONFIGURASI SERVER PRODUKSI JHQ (Target Real Foto)
const NEW_SUPABASE_URL = 'https://jhqlrmlqvdatufbuhtsp.supabase.co';
const NEW_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpocWxybWxxdmRhdHVmYnVodHNwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTM3OTMyOCwiZXhwIjoyMDg0OTU1MzI4fQ.2nJpea2753HseDiKENoUEXinta1T2ykiu0A5NTGFcek';

// DATABASE TARGET (Untuk update Link)
const DB_CONNECTION = 'postgresql://postgres.jhqlrmlqvdatufbuhtsp:082139063266@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres';

const oldSupabase = createClient(OLD_SUPABASE_URL, OLD_SUPABASE_KEY);
const newSupabase = createClient(NEW_SUPABASE_URL, NEW_SUPABASE_KEY);

async function migrate() {
    console.log('--- STARTING REAL PRODUCTION STORAGE MIGRATION ---');

    // 1. List files in 'uploads' old project
    const { data: files, error: listError } = await oldSupabase.storage.from('uploads').list('', { limit: 1000 });
    if (listError) {
        console.error('Error listing old files:', listError);
        return;
    }

    console.log(`Found ${files.length} files to migrate.`);

    for (const file of files) {
        if (file.name === '.emptyFolderPlaceholder') continue;

        console.log(`Migrating to JHQ: ${file.name}...`);

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

    // 2. Update Database URLs to point to JHQ
    console.log('\n--- UPDATING DATABASE LINKS TO JHQ ---');
    const pgClient = new Client({ connectionString: DB_CONNECTION });
    await pgClient.connect();

    try {
        const oldRef = 'opondzzpzxsfucakqwgz';
        const newRef = 'jhqlrmlqvdatufbuhtsp';
        const midRef = 'euxinsbjfukszxzejbop'; // In case some were updated to this

        // Fix all possible variants
        const queries = [
            `UPDATE attendance SET selfie_url = REPLACE(selfie_url, '${oldRef}', '${newRef}') WHERE selfie_url LIKE '%${oldRef}%'`,
            `UPDATE attendance SET selfie_url = REPLACE(selfie_url, '${midRef}', '${newRef}') WHERE selfie_url LIKE '%${midRef}%'`,
            `UPDATE attendance SET checkout_selfie_url = REPLACE(checkout_selfie_url, '${oldRef}', '${newRef}') WHERE checkout_selfie_url LIKE '%${oldRef}%'`,
            `UPDATE attendance SET checkout_selfie_url = REPLACE(checkout_selfie_url, '${midRef}', '${newRef}') WHERE checkout_selfie_url LIKE '%${midRef}%'`,
            `UPDATE leave_requests SET attachment_url = REPLACE(attachment_url, '${oldRef}', '${newRef}') WHERE attachment_url LIKE '%${oldRef}%'`,
            `UPDATE leave_requests SET attachment_url = REPLACE(attachment_url, '${midRef}', '${newRef}') WHERE attachment_url LIKE '%${midRef}%'`,
            `UPDATE transactions SET image_url = REPLACE(image_url, '${oldRef}', '${newRef}') WHERE image_url LIKE '%${oldRef}%'`,
            `UPDATE transactions SET image_url = REPLACE(image_url, '${midRef}', '${newRef}') WHERE image_url LIKE '%${midRef}%'`
        ];

        for (const q of queries) {
            try {
                const res = await pgClient.query(q);
                console.log(`Query Success: ${res.rowCount} rows updated.`);
            } catch (e) {
                // Ignore column not found errors for checkout variants
            }
        }

        console.log(`Database links fixed to JHQ.`);
    } catch (err) {
        console.error('Database update error:', err);
    } finally {
        await pgClient.end();
    }

    console.log('\n✅ REAL PRODUCTION MIGRATION COMPLETED!');
}

migrate();
