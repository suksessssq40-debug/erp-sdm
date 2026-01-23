import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import ExcelJS from 'exceljs';
import { authorize } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const user = await authorize(['OWNER', 'FINANCE']);
    const { tenantId } = user;

    const formData = await request.formData();
    const file = formData.get('file') as File;
    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });

    const buffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    
    let sheet = workbook.getWorksheet('Template Import') || workbook.getWorksheet('Sheet1') || workbook.getWorksheet(1);
    if (sheet && sheet.name.toUpperCase().includes('REFER')) {
        workbook.eachSheet((sh) => {
            if (!sh.name.toUpperCase().includes('REFER') && !sh.name.toUpperCase().includes('PANDUAN')) sheet = sh;
        });
    }

    if (!sheet || sheet.actualRowCount <= 1) return NextResponse.json({ error: 'File kosong.' }, { status: 400 });

    // 1. LOAD MASTER DATA
    const [accounts, coas, units] = await Promise.all([
        prisma.financialAccount.findMany({ where: { tenantId } }),
        prisma.chartOfAccount.findMany({ where: { tenantId } }),
        prisma.businessUnit.findMany({ where: { tenantId } })
    ]);

    const accMap = new Map();
    const coaMap = new Map();
    const unitMap = new Map();
    const normalize = (s: string) => s ? s.toString().toLowerCase().trim().replace(/\s+/g, ' ') : '';

    accounts.forEach(a => {
        accMap.set(normalize(a.name), a);
        accMap.set(normalize(a.bankName), a); 
        accMap.set(normalize(`${a.bankName} - ${a.name}`), a);
        if (a.name.includes('-')) a.name.split('-').forEach(p => { if(p.trim().length > 2) accMap.set(normalize(p), a); });
    });

    coas.forEach(c => {
        coaMap.set(normalize(c.code), c); 
        coaMap.set(normalize(c.name), c); 
        coaMap.set(normalize(`${c.code} - ${c.name}`), c);
    });

    units.forEach(u => {
        unitMap.set(normalize(u.name), u);
        // Smart matching untuk unit (Pare Digital -> Pare Digital Custom)
        if (u.name.includes(' ')) u.name.split(' ').forEach(p => { if(p.trim().length > 3) unitMap.set(normalize(p), u); });
    });

    const rowsToProcess: any[] = [];
    const errors: string[] = [];
    const datesFound: Date[] = [];

    // 2. EXTRACTION & STRICT VALIDATION
    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber === 1) return;

        const dateCell = row.getCell(1).value;
        const descCell = row.getCell(2).value;
        const debitCell = row.getCell(3).value;
        const creditCell = row.getCell(4).value;
        const amountCell = row.getCell(5).value;
        const unitCell = row.getCell(6).value;
        const statusCell = row.getCell(7).value;

        // PARSE NOMINAL
        const amount = (() => {
            if (typeof amountCell === 'number') return amountCell;
            if (!amountCell) return 0;
            const str = amountCell.toString().replace(/[Rp\s.]/gi, '').replace(',', '.');
            return parseFloat(str);
        })();
        if (!amount || amount <= 0) { if(amountCell) errors.push(`Brs ${rowNumber}: Nominal invalid.`); return; }

        // MAPPING UNIT (STRICT)
        const unitData = unitMap.get(normalize(unitCell as string));
        if (!unitData) {
            errors.push(`Brs ${rowNumber}: Unit Bisnis '${unitCell}' tidak ditemukan.`);
            return;
        }

        // MAPPING ACCOUNT
        const dStr = normalize(debitCell as string);
        const cStr = normalize(creditCell as string);
        const dBank = accMap.get(dStr);
        const cBank = accMap.get(cStr);
        const dCoa = coaMap.get(dStr);
        const cCoa = coaMap.get(cStr);

        let type: 'IN' | 'OUT' | null = null;
        let accountId: string | null = null; 
        let coaId: string | null = null;
        let accountName = '';
        let categoryName = '';

        if (dBank) {
            type = 'IN'; accountId = dBank.id; accountName = dBank.name;
            if (cCoa) { coaId = cCoa.id; categoryName = cCoa.name; }
        } else if (cBank) {
            type = 'OUT'; accountId = cBank.id; accountName = cBank.name;
            if (dCoa) { coaId = dCoa.id; categoryName = dCoa.name; }
        }

        if (!type || !accountId) {
            errors.push(`Brs ${rowNumber}: Akun Bank '${debitCell}/${creditCell}' tidak dikenali.`);
            return;
        }

        const sNorm = normalize(statusCell as string);
        const finalStatus = (sNorm.includes('unpaid') || sNorm.includes('belum') || sNorm.includes('pending')) ? 'UNPAID' : 'PAID';

        let finalDate = new Date();
        if (dateCell instanceof Date) {
            finalDate = dateCell;
        } else if (dateCell) { 
            const p = new Date(dateCell.toString()); 
            if(!isNaN(p.getTime())) finalDate = p; 
        }
        
        // NORMALISASI JAM: Set ke 12:00 UTC untuk menghindari pergeseran tanggal
        // saat dikonversi ke DB Date (yang memotong jam) atau saat diambil kembali.
        finalDate.setUTCHours(12, 0, 0, 0);

        datesFound.push(finalDate);

        rowsToProcess.push({
            date: finalDate, amount, type, desc: descCell?.toString() || `Import Brs ${rowNumber}`,
            accountId, coaId, businessUnitId: unitData.id, status: finalStatus, account: accountName, category: categoryName || 'Import'
        });
    });

    if (rowsToProcess.length === 0) return NextResponse.json({ error: 'Tidak ada baris valid.', details: errors }, { status: 400 });

    // 3. DETEKSI DUPLIKAT (Ambil data DB di range tanggal yang sama)
    const minDate = new Date(Math.min(...datesFound.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...datesFound.map(d => d.getTime())));
    
    const existingTransactions = await prisma.transaction.findMany({
        where: {
            tenantId,
            date: { gte: minDate, lte: maxDate }
        }
    });

    const batchId = `BATCH_${Date.now()}`;
    const validRowsToInsert: any[] = [];

    for (const row of rowsToProcess) {
        // Cek apakah ada yang mirip di DB
        const isDuplicate = existingTransactions.find(t => 
            t.accountId === row.accountId &&
            Number(t.amount) === row.amount &&
            t.description === row.desc &&
            t.date?.toISOString().split('T')[0] === row.date.toISOString().split('T')[0]
        );

        if (isDuplicate) {
            errors.push(`Brs (Duplicate): Skip transaksi '${row.desc}' senilai ${row.amount} karena sudah ada di database.`);
            continue;
        }
        validRowsToInsert.push(row);
    }

    // 4. ATOMIC SAVE & BALANCE UPDATE
    let importedCount = 0;
    if (validRowsToInsert.length > 0) {
        await prisma.$transaction(async (tx) => {
            for (const row of validRowsToInsert) {
                const uniqueId = `IMP_${batchId}_${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
                
                await (tx as any).transaction.create({
                    data: {
                        id: uniqueId,
                        tenantId,
                        date: row.date,
                        amount: row.amount,
                        type: row.type,
                        description: row.desc,
                        accountId: row.accountId,
                        coaId: row.coaId,
                        businessUnitId: row.businessUnitId,
                        account: row.account,
                        status: row.status,
                        category: row.category,
                        createdAt: new Date()
                    }
                });

                const change = row.type === 'IN' ? row.amount : -row.amount;
                await (tx as any).financialAccount.update({
                    where: { id: row.accountId },
                    data: { balance: { increment: change } }
                });
                importedCount++;
            }
        });
    }

    return NextResponse.json({ 
        success: true, 
        processed: importedCount, 
        batchId, // Kembalikan BatchId agar bisa di Undo jika perlu
        errors,
        message: importedCount > 0 ? `Berhasil mengimport ${importedCount} transaksi.` : `Tidak ada transaksi baru yang ditambahkan.`
    });

  } catch (error: any) {
    console.error('CRITICAL IMPORT ERROR:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
