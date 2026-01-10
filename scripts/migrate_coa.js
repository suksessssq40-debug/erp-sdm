const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const getAccountType = (code) => {
    const prefix = code.substring(0, 1);
    // 1-Assets, 2-Liabilities, 3-Equity, 4-Revenue, 5-COGS, 6-Expense, 7-Other Revenue, 8-Other Expense
    if (prefix === '1') return { type: 'ASSET', normalPos: 'DEBIT' };
    if (prefix === '2') return { type: 'LIABILITY', normalPos: 'CREDIT' };
    if (prefix === '3') return { type: 'EQUITY', normalPos: 'CREDIT' };
    if (prefix === '4') return { type: 'REVENUE', normalPos: 'CREDIT' };
    if (prefix === '5') return { type: 'EXPENSE', normalPos: 'DEBIT' }; // COGS is Expense nature
    if (prefix === '6') return { type: 'EXPENSE', normalPos: 'DEBIT' };
    if (prefix === '7') return { type: 'REVENUE', normalPos: 'CREDIT' }; // Other Rev
    if (prefix === '8') return { type: 'EXPENSE', normalPos: 'DEBIT' }; // Other Exp
    return { type: 'ASSET', normalPos: 'DEBIT' }; // Default fallback
};

async function migrate() {
    console.log("🚀 Starting COA Migration...");
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');

        // 1. Fetch Old Categories
        console.log("📥 Reading old categories...");
        const resCats = await client.query('SELECT * FROM transaction_categories');
        const categories = resCats.rows;
        
        console.log(`found ${categories.length} categories.`);

        // 2. Process & Deduplicate
        const coaMap = new Map(); // code -> data

        for (const cat of categories) {
            // Extract Code: "134100-Piutang" -> "134100"
            const parts = cat.name.split('-');
            const potentialCode = parts[0].trim();
            const potentialName = parts.slice(1).join('-').trim() || cat.name; // Jika tidak ada dash, pakai nama asli

            // Validasi apakah ini kode angka
            if (/^\d+$/.test(potentialCode) && potentialCode.length >= 3) {
                const { type, normalPos } = getAccountType(potentialCode);
                
                // Jika Code belum ada, atau jika nama yang baru lebih panjang (lebih deskriptif), simpan
                if (!coaMap.has(potentialCode)) {
                    coaMap.set(potentialCode, {
                        id: `coa_${potentialCode}`,
                        code: potentialCode,
                        name: potentialName,
                        type,
                        normalPos
                    });
                }
            } else {
                console.log(`⚠️ Skipping non-standard category: ${cat.name}`);
            }
        }

        console.log(`✨ Processed into ${coaMap.size} unique accounts.`);

        // 3. Insert to Chart of Accounts
        // Clear old test data if any specific to this migration? No, lets upsert.
        for (const acc of coaMap.values()) {
            await client.query(`
                INSERT INTO chart_of_accounts (id, code, name, type, "normalPos", is_active, created_at)
                VALUES ($1, $2, $3, $4, $5, true, $6)
                ON CONFLICT (code) DO NOTHING
            `, [acc.id, acc.code, acc.name, acc.type, acc.normalPos, Date.now()]);
        }
        console.log("✅ COA Inserted.");

        // 4. Migrate Transactions (Link to COA)
        console.log("🔄 Linking Transactions...");
        const resTrans = await client.query('SELECT id, category FROM transactions WHERE coa_id IS NULL AND category IS NOT NULL');
        let updateCount = 0;

        for (const txn of resTrans.rows) {
            const parts = txn.category.split('-');
            const code = parts[0].trim();
            
            // Cari COA ID berdasarkan Kode
            if (coaMap.has(code)) {
                const coaId = coaMap.get(code).id;
                await client.query(`
                    UPDATE transactions 
                    SET coa_id = $1, status = 'PAID' 
                    WHERE id = $2
                `, [coaId, txn.id]);
                updateCount++;
            }
        }
        
        console.log(`✅ Updated ${updateCount} transactions with COA links.`);
        
        await client.query('COMMIT');
        console.log("🎉 Migration Complete Success!");

    } catch (e) {
        await client.query('ROLLBACK');
        console.error("❌ Migration Failed:", e);
    } finally {
        client.release();
        pool.end();
    }
}

migrate();
