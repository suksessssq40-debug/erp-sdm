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

        let sheet = workbook.getWorksheet('Template Import') || workbook.getWorksheet('Sheet1') || workbook.getWorksheet(1);
        if (sheet && sheet.name.toLowerCase().includes('referensi')) {
            workbook.eachSheet((sh) => {
                const n = sh.name.toLowerCase();
                if (!n.includes('referensi') && !n.includes('panduan')) sheet = sh;
            });
        }

        if (!sheet || sheet.actualRowCount <= 1) return NextResponse.json({ error: 'File kosong atau format salah.' }, { status: 400 });

        const [accounts, coas, units] = await Promise.all([
            prisma.financialAccount.findMany({ where: { tenantId, isActive: true } }),
            prisma.chartOfAccount.findMany({ where: { tenantId, isActive: true } }),
            prisma.businessUnit.findMany({ where: { tenantId, isActive: true } })
        ]);

        const accMap = new Map();
        const coaMap = new Map();
        const unitMap = new Map();
        const normalize = (s: any) => s ? s.toString().toLowerCase().trim().replace(/\s+/g, ' ') : '';

        accounts.forEach(a => {
            const n = normalize(a.name);
            accMap.set(n, a);
            const b = normalize(a.bankName);
            if (b) accMap.set(b, a);
            accMap.set(normalize(`${a.bankName} - ${a.name}`), a);
        });

        coas.forEach(c => {
            coaMap.set(normalize(c.code), c);
            coaMap.set(normalize(c.name), c);
            coaMap.set(normalize(`${c.code} - ${c.name}`), c);
        });

        units.forEach(u => unitMap.set(normalize(u.name), u));

        const rowsToProcess: any[] = [];
        const errors: string[] = [];
        const datesFound: Date[] = [];

        for (let i = 2; i <= sheet.rowCount; i++) {
            const row = sheet.getRow(i);
            const dateCell = row.getCell(1).value;
            const descCell = row.getCell(2).value;
            const debitCell = row.getCell(3).value;
            const creditCell = row.getCell(4).value;
            const amountCell = row.getCell(5).value;
            const unitCell = row.getCell(6).value;

            if (!dateCell && !descCell && !amountCell) continue;

            let finalDate = new Date();
            if (dateCell instanceof Date) finalDate = dateCell;
            else if (dateCell) {
                const p = new Date(dateCell.toString());
                if (!isNaN(p.getTime())) finalDate = p;
                else { errors.push(`Brs ${i}: Tanggal '${dateCell}' tidak valid.`); continue; }
            } else { errors.push(`Brs ${i}: Tanggal wajib.`); continue; }

            const amount = (() => {
                if (typeof amountCell === 'number') return amountCell;
                if (!amountCell) return 0;
                const str = amountCell.toString().replace(/[Rp\s.]/gi, '').replace(',', '.');
                return parseFloat(str);
            })();
            if (!amount || amount <= 0) { errors.push(`Brs ${i}: Nominal '${amountCell}' tidak valid.`); continue; }

            const unitData = unitMap.get(normalize(unitCell)) || units[0]; // fallback to first unit if none
            if (!unitData) { errors.push(`Brs ${i}: Unit '${unitCell}' tidak valid.`); continue; }

            if (!debitCell || !creditCell) {
                errors.push(`Brs ${i}: Akun Debet dan Kredit wajib diisi.`);
                continue;
            }

            const dBank = accMap.get(normalize(debitCell));
            const cBank = accMap.get(normalize(creditCell));
            const dCoa = coaMap.get(normalize(debitCell));
            const cCoa = coaMap.get(normalize(creditCell));

            if (!dBank && !dCoa) { errors.push(`Brs ${i}: Akun Debet '${debitCell.toString()}' tidak ditemukan.`); continue; }
            if (!cBank && !cCoa) { errors.push(`Brs ${i}: Akun Kredit '${creditCell.toString()}' tidak ditemukan.`); continue; }

            // Double Entry Universal Logic (Same as Manual Input)
            let type: 'IN' | 'OUT' = 'IN';
            let financialAccountId = null;
            let finalAccountLabel = debitCell.toString();
            let finalCategoryLabel = creditCell.toString();

            if (dBank || cBank) {
                const bank = dBank || cBank;
                financialAccountId = bank?.id;
                // Consistency with UI: Bank name in 'account' field
                if (dBank && !cBank) {
                    type = 'IN';
                    finalAccountLabel = dBank.name;
                    finalCategoryLabel = creditCell.toString();
                } else if (cBank && !dBank) {
                    type = 'OUT';
                    finalAccountLabel = cBank.name;
                    finalCategoryLabel = debitCell.toString();
                } else {
                    // Transfer
                    type = 'OUT';
                    finalAccountLabel = cBank.name;
                    finalCategoryLabel = dBank.name;
                }
            } else {
                // General Journal
                if (dCoa?.type === 'EXPENSE') type = 'OUT';
                else if (cCoa?.type === 'REVENUE' || cCoa?.type === 'INCOME') type = 'IN';
                else type = 'IN';

                finalAccountLabel = debitCell.toString();
                finalCategoryLabel = creditCell.toString();
            }

            const coaId = (cCoa?.type === 'REVENUE' || cCoa?.type === 'EXPENSE')
                ? cCoa.id
                : (dCoa?.type === 'REVENUE' || dCoa?.type === 'EXPENSE')
                    ? dCoa.id
                    : cCoa?.id || dCoa?.id || null;

            datesFound.push(finalDate);
            rowsToProcess.push({
                date: finalDate,
                amount,
                type,
                description: descCell?.toString() || `Import Jurnal Brs ${i}`,
                bankDebitId: dBank?.id,
                bankCreditId: cBank?.id,
                financialAccountId, // Main bank link for transaction record
                coaId,
                businessUnitId: unitData.id,
                account: finalAccountLabel,
                category: finalCategoryLabel,
                status: 'PAID'
            });
        }

        const batchId = `IMP_${Date.now()}`;
        let importedCount = 0;

        if (rowsToProcess.length > 0) {
            await prisma.$transaction(async (tx) => {
                for (const row of rowsToProcess) {
                    const uniqueId = `IMP_${batchId}_${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

                    await (tx as any).transaction.create({
                        data: {
                            id: uniqueId,
                            tenantId,
                            date: row.date,
                            amount: row.amount,
                            type: row.type,
                            description: row.description,
                            accountId: row.financialAccountId,
                            coaId: row.coaId,
                            businessUnitId: row.businessUnitId,
                            account: row.account,
                            category: row.category,
                            status: row.status,
                            createdAt: new Date()
                        }
                    });

                    // Update Balance for DEBIT bank (+)
                    if (row.bankDebitId) {
                        await (tx as any).financialAccount.update({
                            where: { id: row.bankDebitId },
                            data: { balance: { increment: row.amount } }
                        });
                    }
                    // Update Balance for CREDIT bank (-)
                    if (row.bankCreditId) {
                        await (tx as any).financialAccount.update({
                            where: { id: row.bankCreditId },
                            data: { balance: { decrement: row.amount } }
                        });
                    }
                    importedCount++;
                }
            }, { timeout: 60000 });
        }

        return NextResponse.json({
            success: true,
            processed: importedCount,
            batchId,
            errors,
            message: `Berhasil mengimport ${importedCount} jurnal.`
        });

    } catch (error: any) {
        console.error('CRITICAL_IMPORT_ERROR:', error);
        return NextResponse.json({ error: error.message || 'Gagal memproses file.' }, { status: 500 });
    }
}
