const fetch = require('node-fetch');

// This script simulates a call to the my-tenants API with a REAL token if you have one.
// Since I don't have a real token here, I will just check if the route exists and doesn't 404.
async function verify() {
    try {
        const res = await fetch('http://localhost:3000/api/auth/my-tenants', {
            headers: { 'Authorization': 'Bearer sample_token' }
        });
        console.log('API Status:', res.status);
        const data = await res.json().catch(() => ({}));
        console.log('API Response:', data);
    } catch (e) {
        console.log('Fetch failed (probably server not running on 3000):', e.message);
    }
}
verify();
