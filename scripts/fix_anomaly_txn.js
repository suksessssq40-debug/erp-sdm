require('dotenv').config({ path: '.env' });
const { Client } = require('pg');

/**
 * FIX: Transaction TRX_1774501063233_WQLPW has incorrect type='IN'
 * for a bank-to-bank transfer.
 *
 * Current (WRONG):
 *   type=IN, account=120006-Kas BCA SDM-PDC 65841, category=120005-Kas Mandiri Jaka 18887
 *   amount=2040000
 *   Effect: BCA SDM-PDC gets +2040000 (as if money arrived at BCA)
 *           Mandiri Jaka GETS NOTHING (category on IN is ignored)
 *
 * Correct (by write convention for Bank→Bank transfer):
 *   type=OUT, account=120006-Kas BCA SDM-PDC 65841 (source), category=120005-Kas Mandiri Jaka 18887 (dest)
 *   Effect: BCA SDM-PDC gets -2040000 (money left BCA)
 *           Mandiri Jaka gets +2040000 (money arrived at Mandiri)
 *
 * We ONLY change type from 'IN' to 'OUT'. Account and category labels don't need swapping
 * because account=BCA (source/credit side) and category=Mandiri (dest/debit side)
 * which is already correct for an OUT transfer.
 *
 * Balance impact correction needed:
 *   BCA SDM-PDC (120006):  currently got +2040000 (as IN), should get -2040000 (as OUT transfer-source)
 *     → net correction for BCA: -2040000 - 2040000 = -4080000
 *   Mandiri Jaka (120005): currently got 0, should get +2040000 (as OUT transfer-dest)
 *     → net correction for Mandiri: +2040000
 */
async function main() {
  const client = new Client({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });
  await client.connect();

  const TXN_ID = 'TRX_1774501063233_WQLPW';
  const tenantId = 'sdm';
  const AMOUNT = 2040000;
  const BCA_NAME = '120006-Kas BCA SDM-PDC 65841';
  const MANDIRI_NAME = '120005-Kas Mandiri Jaka 18887';

  console.log('=== PRE-FIX STATE ===');
  const txBefore = await client.query('SELECT id, type, account, category, amount::numeric FROM transactions WHERE id=$1', [TXN_ID]);
  console.log('Transaction:', JSON.stringify(txBefore.rows[0]));

  const bcaBefore = await client.query('SELECT name, balance::numeric FROM financial_accounts WHERE tenant_id=$1 AND LOWER(name)=LOWER($2)', [tenantId, BCA_NAME]);
  const mandiriBefore = await client.query('SELECT name, balance::numeric FROM financial_accounts WHERE tenant_id=$1 AND LOWER(name)=LOWER($2)', [tenantId, MANDIRI_NAME]);
  console.log('BCA balance:', bcaBefore.rows[0]?.balance);
  console.log('Mandiri balance:', mandiriBefore.rows[0]?.balance);

  // Begin atomic fix
  await client.query('BEGIN');
  try {
    // 1. Fix the transaction type
    await client.query(
      `UPDATE transactions SET type = 'OUT' WHERE id = $1 AND tenant_id = $2`,
      [TXN_ID, tenantId]
    );
    console.log('\n✅ Transaction type changed to OUT');

    // 2. Fix BCA balance:
    //    Was counted as: account=BCA, type=IN → +2040000 to BCA (WRONG)
    //    Should be:      account=BCA, type=OUT → -2040000 from BCA (CORRECT for transfer-source)
    //    Net correction: -2040000 (undo wrong +) and -2040000 (apply correct -)  = -4080000
    await client.query(
      `UPDATE financial_accounts SET balance = balance - $1 WHERE tenant_id = $2 AND LOWER(name) = LOWER($3)`,
      [AMOUNT * 2, tenantId, BCA_NAME]
    );
    console.log('✅ BCA balance corrected by -' + (AMOUNT * 2));

    // 3. Fix Mandiri balance:
    //    Was counted as: category=Mandiri, type=IN → 0 (anomaly, ignored)
    //    Should be:      category=Mandiri, type=OUT → +2040000 to Mandiri (CORRECT for transfer-dest)
    //    Net correction: +2040000
    await client.query(
      `UPDATE financial_accounts SET balance = balance + $1 WHERE tenant_id = $2 AND LOWER(name) = LOWER($3)`,
      [AMOUNT, tenantId, MANDIRI_NAME]
    );
    console.log('✅ Mandiri balance corrected by +' + AMOUNT);

    await client.query('COMMIT');
    console.log('\n✅ COMMIT SUCCESS');

    // Verify
    console.log('\n=== POST-FIX STATE ===');
    const txAfter = await client.query('SELECT id, type, account, category, amount::numeric FROM transactions WHERE id=$1', [TXN_ID]);
    console.log('Transaction:', JSON.stringify(txAfter.rows[0]));

    const bcaAfter = await client.query('SELECT name, balance::numeric FROM financial_accounts WHERE tenant_id=$1 AND LOWER(name)=LOWER($2)', [tenantId, BCA_NAME]);
    const mandiriAfter = await client.query('SELECT name, balance::numeric FROM financial_accounts WHERE tenant_id=$1 AND LOWER(name)=LOWER($2)', [tenantId, MANDIRI_NAME]);
    console.log('BCA balance:', bcaAfter.rows[0]?.balance, '(was:', bcaBefore.rows[0]?.balance + ')');
    console.log('Mandiri balance:', mandiriAfter.rows[0]?.balance, '(was:', mandiriBefore.rows[0]?.balance + ')');
    console.log('\nExpected Mandiri delta: +' + AMOUNT + ' = correct transfer arrival');
    console.log('Expected BCA delta    : -' + (AMOUNT * 2) + ' = undo wrong +' + AMOUNT + ' and apply correct -' + AMOUNT);

  } catch (e) {
    await client.query('ROLLBACK');
    console.error('❌ ROLLBACK:', e.message);
    throw e;
  } finally {
    await client.end();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
