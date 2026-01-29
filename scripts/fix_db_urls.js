const { Client } = require('pg');

const DB_CONNECTION = 'postgresql://postgres.euxinsbjfukszxzejbop:082139063266@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres';

async function fix() {
    const pgClient = new Client({ connectionString: DB_CONNECTION });
    await pgClient.connect();

    try {
        const oldRef = 'opondzzpzxsfucakqwgz';
        const newRef = 'euxinsbjfukszxzejbop';

        console.log('Fixing URLs...');

        // 1. Attendance
        await pgClient.query(`UPDATE attendance SET selfie_url = REPLACE(selfie_url, '${oldRef}', '${newRef}') WHERE selfie_url LIKE '%${oldRef}%'`);

        // Try both possible checkout column names
        try {
            await pgClient.query(`UPDATE attendance SET checkout_selfie_url = REPLACE(checkout_selfie_url, '${oldRef}', '${newRef}') WHERE checkout_selfie_url LIKE '%${oldRef}%'`);
            console.log('Updated checkout_selfie_url');
        } catch (e) {
            try {
                await pgClient.query(`UPDATE attendance SET check_out_selfie_url = REPLACE(check_out_selfie_url, '${oldRef}', '${newRef}') WHERE check_out_selfie_url LIKE '%${oldRef}%'`);
                console.log('Updated check_out_selfie_url');
            } catch (e2) { console.log('Could not find checkout selfie column'); }
        }

        // 2. Leave Requests
        try {
            await pgClient.query(`UPDATE leave_requests SET attachment_url = REPLACE(attachment_url, '${oldRef}', '${newRef}') WHERE attachment_url LIKE '%${oldRef}%'`);
            console.log('Updated leave_requests');
        } catch (e) { console.log('No leave_requests table or attachment_url column'); }

        // 3. Transactions
        try {
            await pgClient.query(`UPDATE transactions SET image_url = REPLACE(image_url, '${oldRef}', '${newRef}') WHERE image_url LIKE '%${oldRef}%'`);
            console.log('Updated transactions');
        } catch (e) { console.log('No transactions table or image_url column'); }

        console.log('Done.');
    } finally {
        await pgClient.end();
    }
}

fix();
