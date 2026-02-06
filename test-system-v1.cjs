
const jwt = require('jsonwebtoken');

async function runTest() {
    const SECRET = 'rahasia_sdm_erp_123';
    const API_URL = 'http://localhost:3000/api/requests';

    // 1. Tokens
    const staffToken = jwt.sign({ id: 'uaecqr9g0', name: 'Tester Staf', role: 'STAFF', tenantId: 'sdm' }, SECRET);
    const ownerToken = jwt.sign({ id: 'j7ze43475-manjada', name: 'Pak Jaka', role: 'OWNER', tenantId: 'sdm' }, SECRET);

    const requestId = 'TEST-' + Math.floor(Math.random() * 100000);

    console.log('--- 🧪 STARTING SYSTEM TEST: TELEGRAM NOTIFICATIONS ---');

    try {
        // TEST 1: SUBMIT REQUEST
        console.log('\n[1/3] Testing SUBMISSION...');
        const subRes = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + staffToken
            },
            body: JSON.stringify({
                id: requestId,
                userId: 'uaecqr9g0',
                type: 'Test Izin',
                description: 'Uji coba sistem notifikasi Telegram baru (Agentic Test)',
                startDate: new Date().toISOString(),
                status: 'PENDING',
                createdAt: Date.now()
            })
        });

        if (subRes.ok) {
            console.log('✅ Submission Success (HTTP 201)');
        } else {
            console.error('❌ Submission Failed Status:', subRes.status);
            const err = await subRes.json();
            console.error('Error Details:', err);
            return;
        }

        // TEST 2: APPROVAL
        console.log('\n[2/3] Testing APPROVAL...');
        const appRes = await fetch(`${API_URL}/${requestId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + ownerToken
            },
            body: JSON.stringify({
                status: 'APPROVED',
                actionNote: 'Disetujui secara otomatis oleh sistem uji coba.',
                type: 'Test Izin',
                description: 'Uji coba sistem notifikasi Telegram baru (Agentic Test)',
                startDate: new Date().toISOString()
            })
        });

        if (appRes.ok) {
            console.log('✅ Approval Success (HTTP 200)');
        } else {
            console.error('❌ Approval Failed Status:', appRes.status);
            const err = await appRes.json();
            console.error('Error Details:', err);
        }

        // TEST 3: CLEANUP
        console.log('\n[3/3] Cleaning up test data...');
        const delRes = await fetch(`${API_URL}/${requestId}`, {
            method: 'DELETE',
            headers: { 'Authorization': 'Bearer ' + ownerToken }
        });

        if (delRes.ok) {
            console.log('✅ Cleanup Success');
        } else {
            console.error('❌ Cleanup Failed');
        }

        console.log('\n--- 🏁 TEST COMPLETED ---');
        console.log('Periksa Grup Telegram TEE Anda untuk melihat notifikasi yang masuk.');
    } catch (e) {
        console.error('SYSTEM ERROR DURING TEST:', e.message);
        console.log('Pastikan Server Next.js (Port 3000) sedang berjalan!');
    }
}

runTest();
