require('dotenv').config({ path: '.env' });
const { Client } = require('pg');

async function main() {
  const DIRECT_URL = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!DIRECT_URL) {
    console.error('No DATABASE_URL or DIRECT_URL found in .env.local');
    process.exit(1);
  }

  const client = new Client({ connectionString: DIRECT_URL });
  await client.connect();

  const accName = '120005-Kas Mandiri Jaka 18887';
  const tenantId = 'sdm';

  // 1. Cached balance
  const faRes = await client.query(
    `SELECT id, name, balance::numeric FROM financial_accounts WHERE tenant_id=$1 AND LOWER(name)=LOWER($2)`,
    [tenantId, accName]
  );
  const fa = faRes.rows[0];
  console.log('=== CACHED BALANCE ===');
  console.log('Name:', fa ? fa.name : 'NOT FOUND');
  console.log('Cached balance:', fa ? fa.balance : 'N/A');

  // 2. All transactions
  const txRes = await client.query(
    `SELECT id, date::text, type, account, category, amount::numeric, description, status
     FROM transactions
     WHERE tenant_id=$1
       AND (LOWER(account)=LOWER($2) OR LOWER(category)=LOWER($2))
     ORDER BY date ASC, created_at ASC`,
    [tenantId, accName]
  );

  console.log('\n=== TRANSACTIONS (' + txRes.rows.length + ' rows) ===');
  let running = 0;
  const anomalies = [];

  txRes.rows.forEach(function(t) {
    const amt = Number(t.amount);
    let effect = 0;
    let rule = '?';
    const acctMatch = t.account && t.account.toLowerCase() === accName.toLowerCase();
    const catMatch  = t.category && t.category.toLowerCase() === accName.toLowerCase();

    if      (acctMatch && t.type === 'IN')  { effect = +amt; rule = 'IN+account → +DEBIT'; }
    else if (acctMatch && t.type === 'OUT') { effect = -amt; rule = 'OUT+account → -CREDIT'; }
    else if (catMatch  && t.type === 'OUT') { effect = +amt; rule = 'OUT+category → +TRANSFER-DEST'; }
    else if (catMatch  && t.type === 'IN')  { effect = 0;   rule = '!!! ANOMALY: IN+category=IGNORED'; anomalies.push(t); }

    running += effect;
    const flag = rule.includes('ANOMALY') ? ' <<< BUG >>>' : '';
    console.log(
      String(t.date).substring(0,10) + ' | ' + t.type +
      ' | effect=' + String(effect).padStart(12) +
      ' | running=' + String(running).padStart(14) +
      ' | ' + rule + flag +
      '\n       acc=[' + t.account + '] cat=[' + t.category + '] desc=' + String(t.description||'').substring(0,35)
    );
  });

  console.log('\n=== FINAL RESULT ===');
  console.log('Computed from txn:', running);
  console.log('Cached balance   :', fa ? fa.balance : 'N/A');
  if (fa) console.log('Discrepancy      :', running - Number(fa.balance));
  console.log('Anomaly count    :', anomalies.length);
  if (anomalies.length > 0) {
    console.log('\n=== ANOMALY DETAILS ===');
    anomalies.forEach(a => {
      console.log('  ID:', a.id, '| Date:', a.date, '| Amount:', a.amount, '| account=[', a.account, '] category=[', a.category, ']');
    });
  }

  await client.end();
}

main().catch(function(e) { console.error(e); process.exit(1); });
