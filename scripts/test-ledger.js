const fetch = require('node-fetch');

async function main() {
  const url = 'http://localhost:3000/api/finance/ledger?startDate=2026-02-28&endDate=2026-03-30&accountName=TUNAI%20PDC%20-%20110003%20KAS%20KECIL%20PDC';
  
  // Dummy authentication token logic if needed. We might get Unauthorized, but let's try.
  try {
    const res = await fetch(url, {
        headers: {
            // Need a valid token to test locally, we don't have one easily available.
        }
    });
    console.log(res.status);
  } catch (e) {
      console.log(e);
  }
}

main();
