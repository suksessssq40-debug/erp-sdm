
const { Client } = require('pg');

const connectionString = 'postgresql://postgres.opondzzpzxsfucakqwgz:082139063266@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres';

async function forensicSearch() {
  const client = new Client({ connectionString });
  console.log("Forensik Pencarian Data Hilang (Any Date)...");
  
  try {
    await client.connect();

    // Coba cari data yang string-nya mengandung 'Jan 9' atau 'Jan 09' tanpa peduli timestamp created_at
    // Siapa tau jam server ngaco saat insert
    const textSearch = await client.query(`
        SELECT id, user_id, date, created_at 
        FROM attendance 
        WHERE date LIKE '%Jan 9%' OR date LIKE '%Jan 09%' OR date LIKE '%9 Jan%'
    `);
    
    console.log(`\nPencarian Teks Bebas tanggal 9: Ditemukan ${textSearch.rowCount}`);
    if (textSearch.rowCount > 0) {
        textSearch.rows.forEach(r => console.log(JSON.stringify(r)));
    }

  } catch(e) { 
    console.error("Error:", e.message); 
  } finally { 
    await client.end(); 
  }
}

forensicSearch();
