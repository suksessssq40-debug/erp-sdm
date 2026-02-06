
const jwt = require('jsonwebtoken');

async function runMultiUnitTest() {
    const SECRET = 'rahasia_sdm_erp_123';
    const API_URL = 'http://localhost:3000/api/requests';

    const testUnits = [
        { tenantId: 'sdm', staffId: 'uaecqr9g0', name: 'SDM (Kantor Pusat)' },
        { tenantId: 'level-up', staffId: '1768375018077', name: 'Level Up' },
        { tenantId: 'parecustom', staffId: '1769585492052', name: 'Parecustom' },
        { tenantId: 'manjada', staffId: '1768638841903', name: 'Manjada' }
    ];

    console.log('--- 🧪 STARTING MULTI-UNIT SYSTEM TEST ---');
    console.log('Menguji 4 unit bisnis ke masing-masing Topic Telegram...\n');

    for (const unit of testUnits) {
        console.log(`\n>>> TESTING UNIT: ${unit.name} (${unit.tenantId})`);

        const staffToken = jwt.sign({ id: unit.staffId, name: 'Tester ' + unit.name, role: 'STAFF', tenantId: unit.tenantId }, SECRET);
        const ownerToken = jwt.sign({ id: 'owner-' + unit.tenantId, name: 'Owner ' + unit.name, role: 'OWNER', tenantId: unit.tenantId }, SECRET);
        const requestId = 'TEST-' + unit.tenantId + '-' + Math.floor(Math.random() * 1000);

        try {
            // 1. SUBMISSION
            process.stdout.write('   [1/3] Submitting Request... ');
            const subRes = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + staffToken },
                body: JSON.stringify({
                    id: requestId,
                    userId: unit.staffId,
                    type: 'Izin Tes Multi-Unit',
                    description: `Uji coba otomatis untuk unit ${unit.name}. Pastikan masuk ke topiknya masing-masing.`,
                    startDate: new Date().toISOString(),
                    status: 'PENDING',
                    createdAt: Date.now()
                })
            });

            if (subRes.ok) {
                console.log('✅ OK');
            } else {
                console.log('❌ FAILED', await subRes.json());
                continue;
            }

            // 2. APPROVAL
            process.stdout.write('   [2/3] Approving Request...  ');
            const appRes = await fetch(`${API_URL}/${requestId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + ownerToken },
                body: JSON.stringify({
                    status: 'APPROVED',
                    actionNote: 'Disetujui otomatis oleh skrip pengujian multi-unit.',
                    type: 'Izin Tes Multi-Unit',
                    description: `Uji coba otomatis untuk unit ${unit.name}.`,
                    startDate: new Date().toISOString()
                })
            });

            if (appRes.ok) {
                console.log('✅ OK');
            } else {
                console.log('❌ FAILED', await appRes.json());
            }

            // 3. CLEANUP
            process.stdout.write('   [3/3] Cleaning up...        ');
            await fetch(`${API_URL}/${requestId}`, {
                method: 'DELETE',
                headers: { 'Authorization': 'Bearer ' + ownerToken }
            });
            console.log('✅ DONE');

        } catch (e) {
            console.error(`\nERR [${unit.tenantId}]:`, e.message);
        }
    }

    console.log('\n--- 🏁 ALL UNITS TESTED ---');
    console.log('PENTING: Silakan cek di Telegram, harusnya ada 4 pengajuan & 4 persetujuan yang masuk ke TOPIC masing-masing Unit Bisnis.');
}

runMultiUnitTest();
