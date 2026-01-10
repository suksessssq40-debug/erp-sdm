import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import * as XLSX from 'xlsx';

// Helper to determine transaction type and accounts
// Logic:
// If Debit Account is a 'Financial Account' (Bank/Cash) -> Money IN (Type IN, Account=Debit, CoA=Credit)
// If Credit Account is a 'Financial Account' -> Money OUT (Type OUT, Account=Credit, CoA=Debit)
// If both -> Transfer? (Not handled yet, prioritize standard In/Out)
// If neither -> General Journal (Not supported by simple Transaction model yet)

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(sheet);


    // Fetch necessary master data for mapping
    const financialAccounts = await prisma.financialAccount.findMany({ select: { id: true, name: true, bankName: true } });
    const coas = await prisma.chartOfAccount.findMany({ select: { id: true, code: true, name: true } });

    const errors: string[] = [];
    let successCount = 0;
    
    // Normalization Helpers
    const normalize = (str: any) => String(str || '').trim().toLowerCase().replace(/\s+/g, ' ');
    
    // Create Lookup Maps for Speed & Accuracy
    // Map: normalized_name -> object
    const finAccMap = new Map();
    financialAccounts.forEach(f => {
        finAccMap.set(normalize(f.name), f);
        finAccMap.set(normalize(f.bankName), f);
        // Also map combined "BankName - Name" just in case
        finAccMap.set(normalize(`${f.bankName} - ${f.name}`), f);
    });

    const coaMap = new Map();
    coas.forEach(c => {
        coaMap.set(normalize(c.code), c); // Prioritize Code "411000"
        coaMap.set(normalize(c.name), c); // Name "Penjualan"
        coaMap.set(normalize(`${c.code} - ${c.name}`), c); // Full "411000 - Penjualan"
        coaMap.set(normalize(`${c.code} ${c.name}`), c); // Space "411000 Penjualan"
    });

    for (let i = 0; i < jsonData.length; i++) {
      const row = jsonData[i] as any;
      const rowNum = i + 2; // +1 header +1 zero-index

      // Map Columns from Template
      // Support variations: "AKUN_DEBET", "AKUN DEBET", "DEBET"
      const dateRaw = row['TANGGAL'] || row['Tanggal'] || row['Date'];
      const desc = row['KETERANGAN'] || row['Keterangan'] || row['Description'] || `Import Row ${rowNum}`;
      const debitRaw = row['AKUN_DEBET'] || row['AKUN DEBET'] || row['DEBET'] || row['Debit'];
      const creditRaw = row['AKUN_KREDIT'] || row['AKUN KREDIT'] || row['KREDIT'] || row['Credit'];
      const amount = Number(row['NOMINAL'] || row['Nominal'] || row['Amount'] || 0);

      if (!debitRaw || !creditRaw) { 
          // Skip empty rows silently or log?
          if (amount > 0) errors.push(`Baris ${rowNum}: Kolom Debit/Kredit kosong.`);
          continue;
      }
      if (amount <= 0) {
          // Skip zero amounts
          continue;
      }

      // Resolve Accounts
      const finAccDebit = finAccMap.get(normalize(debitRaw));
      const finAccCredit = finAccMap.get(normalize(creditRaw));

      let type = '';
      let accountId = '';
      let coaId = '';
      let finalAccountName = '';

      // LOGIC MATRIX
      
      // CASE 1: TRANSFER (Bank to Bank) - Not supported yet or treat as specific type?
      if (finAccDebit && finAccCredit) {
           errors.push(`Baris ${rowNum}: Transfer antar dua Bank (${debitRaw} ke ${creditRaw}) belum didukung via Import Excel. Gunakan fitur pindah buku manual.`);
           continue;
      }

      // CASE 2: INCOME (Debit = Bank)
      else if (finAccDebit) {
          type = 'IN';
          accountId = finAccDebit.id;
          finalAccountName = finAccDebit.name; // For legacy field

          // Check the other side (Credit) MUST be COA
          const coa = coaMap.get(normalize(creditRaw));
          if (coa) {
              coaId = coa.id;
          } else {
              // Try fuzzy or error? STRICT MODE: Error.
              errors.push(`Baris ${rowNum} (Masuk): Akun Kredit '${creditRaw}' tidak dikenali sebagai COA di sistem.`);
              continue;
          }
      }

      // CASE 3: EXPENSE (Credit = Bank)
      else if (finAccCredit) {
          type = 'OUT';
          accountId = finAccCredit.id;
          finalAccountName = finAccCredit.name;

          // Check the other side (Debit) MUST be COA
          const coa = coaMap.get(normalize(debitRaw));
          if (coa) {
              coaId = coa.id;
          } else {
              errors.push(`Baris ${rowNum} (Keluar): Akun Debit '${debitRaw}' tidak dikenali sebagai COA di sistem.`);
              continue;
          }
      }

      // CASE 4: MUTASI NON-KAS (No Bank Involved)
      else {
           errors.push(`Baris ${rowNum}: Tidak ditemukan Akun KAS/BANK di kolom Debit maupun Kredit. Transaksi non-tunai belum didukung.`);
           continue;
      }

      // Date Parsing
      let date = new Date();
      if (typeof dateRaw === 'number') {
          date = new Date(Math.round((dateRaw - 25569)*86400*1000));
      } else if (dateRaw) {
          // parsing string dates can be tricky. Assume YYYY-MM-DD or use library if needed.
          // Try standard constructor
          const p = new Date(dateRaw);
          if (!isNaN(p.getTime())) date = p;
      }

      // Create Transaction
      await prisma.transaction.create({
          data: {
              id: `IMP_${Math.random().toString(36).substr(2,9)}`,
              date: date,
              amount: amount,
              type,
              description: desc,
              accountId: accountId,
              coaId: coaId,
              account: finalAccountName,
              status: 'PAID',
              category: `${coaMap.get(normalize(creditRaw))?.name || coaMap.get(normalize(debitRaw))?.name}`, // Fallback for legacy display
              createdAt: new Date()
          }
      });
      successCount++;
    }

    return NextResponse.json({ success: true, processed: successCount, errors });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to process file' }, { status: 500 });
  }
}
