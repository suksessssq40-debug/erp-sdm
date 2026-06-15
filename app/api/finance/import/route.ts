
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
        if (!file) return NextResponse.json({ error: 'Tidak ada file yang diunggah' }, { status: 400 });

        const buffer = await file.arrayBuffer();
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer);

        // Find the correct sheet
        let sheet = workbook.getWorksheet('Template Import') || workbook.getWorksheet('Sheet1') || workbook.getWorksheet(1);
        if (sheet && sheet.name.toLowerCase().includes('referensi')) {
            workbook.eachSheet((sh) => {
                const n = sh.name.toLowerCase();
                if (!n.includes('referensi') && !n.includes('panduan')) sheet = sh;
            });
        }

        if (!sheet || sheet.actualRowCount <= 1) return NextResponse.json({ error: 'File kosong atau format salah.' }, { status: 400 });

        // 1. LOAD MASTER DATA (For Validation)
        const [accounts, coas, units] = await Promise.all([
            prisma.financialAccount.findMany({ where: { tenantId } }),
            prisma.chartOfAccount.findMany({ where: { tenantId } }),
            prisma.businessUnit.findMany({ where: { tenantId, isActive: true } })
        ]);

        const accMap = new Map();
        const coaMap = new Map();
        const unitMap = new Map();

        const normalize = (s: any) => s ? s.toString().toLowerCase().trim().replace(/\s+/g, ' ') : '';

        // Build mapping maps
        accounts.forEach(a => {
            accMap.set(normalize(a.name), a);
            accMap.set(normalize(a.bankName), a);
            accMap.set(normalize(`${a.bankName} - ${a.name}`), a);
        });

        coas.forEach(c => {
            coaMap.set(normalize(c.code), c);
            coaMap.set(normalize(c.name), c);
            coaMap.set(normalize(`${c.code} - ${c.name}`), c);
        });

        units.forEach(u => {
            unitMap.set(normalize(u.name), u);
        });

        const rowsToProcess: any[] = [];
        const errors: string[] = [];
        const datesFound: Date[] = [];

        // 2. EXTRACTION & VALIDATION (STRICT)
        for (let i = 2; i <= sheet.rowCount; i++) {
            const row = sheet.getRow(i);
            const dateCell = row.getCell(1).value;
            const descCell = row.getCell(2).value;
            const debitCell = row.getCell(3).value;
            const creditCell = row.getCell(4).value;
            const amountCell = row.getCell(5).value;
            const unitCell = row.getCell(6).value;
            // Status cell is optional as we have description-based logic, but we can capture it
            // const statusCell = row.getCell(7).value;

            if (!dateCell && !descCell && !amountCell) continue; // Skip empty rows

            // PARSE DATE
            let finalDate = new Date();
            if (dateCell instanceof Date) finalDate = dateCell;
            else if (dateCell) {
                const p = new Date(dateCell.toString());
                if (!isNaN(p.getTime())) finalDate = p;
                else { errors.push(`Brs ${i}: Tanggal '${dateCell}' tidak valid.`); continue; }
            } else { errors.push(`Brs ${i}: Tanggal wajib diisi.`); continue; }

            // PARSE NOMINAL
            const amount = (() => {
                if (typeof amountCell === 'number') return amountCell;
                if (!amountCell) return 0;
                const str = amountCell.toString().replace(/[Rp\s.]/gi, '').replace(',', '.');
                return parseFloat(str);
            })();
            if (!amount || amount <= 0) { errors.push(`Brs ${i}: Nominal '${amountCell}' tidak valid.`); continue; }

            // MAPPING UNIT (STRICT)
            const unitData = unitMap.get(normalize(unitCell));
            if (!unitData) {
                errors.push(`Brs ${i}: Unit Bisnis '${unitCell}' tidak terdaftar atau tidak aktif.`);
                continue;
            }

            // MAPPING ACCOUNTS (STRICT)
            const dStr = normalize(debitCell);
            const cStr = normalize(creditCell);

            const dBank = accMap.get(dStr);
            const cBank = accMap.get(cStr);
            const dCoa = coaMap.get(dStr);
            const cCoa = coaMap.get(cStr);

            let type: 'IN' | 'OUT' | null = null;
            let accountId: string | null = null;
            let coaId: string | null = null;
            let accountName = '';
            let categoryName = '';

            // CASE A: Bank (Debit) - Income dari COA (Credit) => IN
            if (dBank && cCoa) {
                type = 'IN';
                accountId = dBank.id;
                accountName = dBank.name;
                coaId = cCoa.id;
                categoryName = `${cCoa.code} - ${cCoa.name}`;
            }
            // CASE B: COA (Debit) - Pengeluaran dari Bank (Credit) => OUT
            else if (dCoa && cBank) {
                type = 'OUT';
                accountId = cBank.id;
                accountName = cBank.name;
                coaId = dCoa.id;
                categoryName = `${dCoa.code} - ${dCoa.name}`;
            }
            // CASE C: COA (Debit) - COA (Credit) => General Journal (IN representation)
            else if (dCoa && cCoa) {
                type = 'IN';
                accountId = null;
                accountName = `${dCoa.code} - ${dCoa.name}`; // Debit Side stored here for GJ
                coaId = cCoa.id;
                categoryName = `${cCoa.code} - ${cCoa.name}`;
            }
            // CASE D: Bank (Debit) - Bank (Credit) => Internal Transfer
            else if (dBank && cBank) {
                // We'll treat as OUT from Credit bank for balance logic, 
                // but ideally this is handled as special Case. 
                // For now, let's treat as separate Mutasi if needed or block it.
                // Let's allow but treat as OUT from Source.
                type = 'OUT';
                accountId = cBank.id;
                accountName = cBank.name;
                categoryName = `Transfer ke ${dBank.name}`;
                // Note: Does not update target bank automatically here to prevent double counting 
                // unless we create 2 transactions.
            } else {
                errors.push(`Brs ${i}: Akun '${debitCell}' atau '${creditCell}' tidak ditemukan/tidak valid.`);
                continue;
            }

            // STATUS DETECTION
            const sNorm = normalize(descCell);
            let finalStatus = 'PAID';
            if (sNorm.includes('pelunasan')) finalStatus = 'PAID';
            else if (sNorm.includes('dp') || sNorm.includes('down payment')) finalStatus = 'UNPAID';

            datesFound.push(finalDate);
            rowsToProcess.push({
                date: finalDate,
                amount,
                type,
                desc: descCell?.toString() || `Import Excel Brs ${i}`,
                accountId,
                coaId,
                businessUnitId: unitData.id,
                status: finalStatus,
                account: accountName,
                category: categoryName || 'Import'
            });
        }

        if (rowsToProcess.length === 0) {
            return NextResponse.json({
                error: 'Tidak ada data valid yang bisa diproses.',
                details: errors
            }, { status: 400 });
        }

        // 3. DUPLICATE CHECK (Same Day, Same Amount, Same Desc, Same Account)
        const minDate = new Date(Math.min(...datesFound.map(d => d.getTime())));
        const maxDate = new Date(Math.max(...datesFound.map(d => d.getTime())));

        const existingTransactions = await prisma.transaction.findMany({
            where: {
                tenantId,
                date: { gte: minDate, lte: maxDate }
            },
            select: { date: true, amount: true, description: true, account: true, accountId: true }
        });

        const batchId = `BATCH_${Date.now()}`;
        const validRowsToInsert: any[] = [];

        for (const row of rowsToProcess) {
            const isDuplicate = existingTransactions.some(t => {
                const sameDate = t.date?.toISOString().split('T')[0] === row.date.toISOString().split('T')[0];
                const sameAmount = Number(t.amount) === row.amount;
                const sameDesc = t.description === row.desc;
                const sameAcc = t.accountId === row.accountId || t.account === row.account;
                return sameDate && sameAmount && sameDesc && sameAcc;
            });

            if (isDuplicate) {
                errors.push(`Skip Duplikat: '${row.desc}' (${row.amount}) sudah ada.`);
                continue;
            }
            validRowsToInsert.push(row);
        }

        // 4. ATOMIC EXECUTION
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

                    // Update Balance immediately if accountId exists
                    if (row.accountId) {
                        const change = row.type === 'IN' ? row.amount : -row.amount;
                        await (tx as any).financialAccount.update({
                            where: { id: row.accountId },
                            data: { balance: { increment: change } }
                        });
                    }
                    importedCount++;
                }
            }, { timeout: 60000 }); // Longer timeout for large batches
        }

        return NextResponse.json({
            success: true,
            processed: importedCount,
            batchId,
            errors,
            message: importedCount > 0
                ? `Berhasil mengimport ${importedCount} transaksi.`
                : `Import selesai, tapi tidak ada transaksi baru yang ditambahkan.`
        });

    } catch (error: any) {
        console.error('CRITICAL IMPORT ERROR:', error);
        return NextResponse.json({ error: error.message || 'Terjadi kesalahan sistem.' }, { status: 500 });
    }
}
