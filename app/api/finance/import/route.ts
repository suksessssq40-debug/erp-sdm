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
    
    // 1. CARI SHEET DATA
    let sheet = workbook.getWorksheet('Template Import') || workbook.getWorksheet('Sheet1');
    if (!sheet) {
        workbook.eachSheet((sh) => {
            const n = sh.name.toUpperCase();
            if (n !== 'REFERUENSI' && n !== 'CARA ISI PANDUAN' && !sheet) sheet = sh;
        });
    }

    if (!sheet || sheet.actualRowCount <= 1) {
        return NextResponse.json({ error: 'Data tidak ditemukan di sheet.' }, { status: 400 });
    }

    // 2. LOAD MASTER DATA
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
        if (a.name.includes('-')) {
             a.name.split('-').forEach(p => { if(p.trim().length > 2) accMap.set(normalize(p), a); });
        }
    });

    coas.forEach(c => {
        coaMap.set(normalize(c.code), c); 
        coaMap.set(normalize(c.name), c); 
        coaMap.set(normalize(`${c.code} - ${c.name}`), c);
        if (c.name.includes('-')) {
             c.name.split('-').forEach(p => { if(p.trim().length > 2) coaMap.set(normalize(p), c); });
        }
    });

    units.forEach(u => {
        unitMap.set(normalize(u.name), u);
        if (u.name.includes(' ')) {
             u.name.split(' ').forEach(p => { if(p.trim().length > 3) unitMap.set(normalize(p), u); });
        }
    });

    const validRows: any[] = [];
    const errors: string[] = [];

    // 3. PARSING DATA
    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber === 1) return;

        const dateCell = row.getCell(1).value;
        const descCell = row.getCell(2).value;
        const debitCell = row.getCell(3).value;
        const creditCell = row.getCell(4).value;
        const amountCell = row.getCell(5).value;
        const unitCell = row.getCell(6).value;
        const statusCell = row.getCell(7).value;

        // PARSE NOMINAL (ROBUST)
        const amount = (() => {
            if (typeof amountCell === 'number') return amountCell;
            if (!amountCell) return 0;
            let s = amountCell.toString().replace(/[Rp\s.]/gi, '').replace(',', '.');
            return parseFloat(s);
        })();
        if (!amount || amount <= 0) return;

        // DETECTION
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

        if (!type || !accountId) return;

        // STATUS MAPPING (Must match Prisma Enum: UNPAID/PAID)
        const sNorm = normalize(statusCell as string);
        const finalStatus = (sNorm.includes('unpaid') || sNorm.includes('belum') || sNorm.includes('pending')) ? 'UNPAID' : 'PAID';

        // UNIT
        const uIdx = unitMap.get(normalize(unitCell as string));
        const businessUnitId = uIdx ? uIdx.id : (units[0]?.id || '');

        let finalDate = new Date();
        if (dateCell instanceof Date) finalDate = dateCell;

        validRows.push({
            date: finalDate, amount, type, desc: descCell?.toString() || `Import Brs ${rowNumber}`,
            accountId, coaId, businessUnitId, status: finalStatus, account: accountName, category: categoryName || 'Import'
        });
    });

    // 4. DATABASE SAVE & BALANCE UPDATE (MENGGUNAKAN NAMA MODEL YANG BENAR)
    if (validRows.length > 0) {
        await prisma.$transaction(async (tx) => {
            for (const row of validRows) {
                const trxId = `IMP_${Math.random().toString(36).substring(2, 11).toUpperCase()}`;
                
                // A. Simpan Transaksi (Pakai model 'transaction' atau 'transaction')
                await (tx as any).transaction.create({
                    data: {
                        id: trxId,
                        tenantId,
                        date: row.date,
                        amount: row.amount,
                        type: row.type,
                        description: row.desc,
                        accountId: row.accountId,
                        coaId: row.coaId,
                        businessUnitId: row.businessUnitId,
                        account: row.account,
                        status: row.status, // Isinya 'UNPAID' atau 'PAID'
                        category: row.category,
                        createdAt: new Date()
                    }
                });

                // B. UPDATE SALDO (PASTIKAN NAMA MODEL SESUAI SCHEMA)
                // Di Prisma Client, biasanya model dibaca sebagai untaCase (financialAccount)
                const change = row.type === 'IN' ? row.amount : -row.amount;
                
                // DEBUG: Kita update saldo secara eksplisit
                await (tx as any).financialAccount.update({
                    where: { id: row.accountId },
                    data: { balance: { increment: change } }
                });
                
                console.log(`[IMPORT SUCCESS] Account ${row.account} updated by ${change}`);
            }
        });
    }

    return NextResponse.json({ 
        success: true, 
        processed: validRows.length, 
        message: `Berhasil import ${validRows.length} transaksi. Selesaikan kemarahan Finance sekarang!` 
    });

  } catch (error: any) {
    console.error('CRITICAL IMPORT ERROR:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
