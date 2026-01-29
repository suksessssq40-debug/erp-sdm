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
            if (a.name.includes('-')) a.name.split('-').forEach(p => { if (p.trim().length > 2) accMap.set(normalize(p), a); });
        });

        coas.forEach(c => {
            coaMap.set(normalize(c.code), c);
            coaMap.set(normalize(c.name), c);
            coaMap.set(normalize(`${c.code} - ${c.name}`), c);
        });

        units.forEach(u => {
            unitMap.set(normalize(u.name), u);
            // Smart matching untuk unit (Pare Digital -> Pare Digital Custom)
            if (u.name.includes(' ')) u.name.split(' ').forEach(p => { if (p.trim().length > 3) unitMap.set(normalize(p), u); });
        });

        const rowsToProcess: any[] = [];
        const errors: string[] = [];
        const datesFound: Date[] = [];

        // Track new objects to avoid duplicate auto-creation in same batch
        const localAccMap = new Map();
        const localCoaMap = new Map();

        // 2. EXTRACTION & SMART MAPPING (WITH AUTO-CREATE)
        for (let i = 2; i <= sheet.rowCount; i++) {
            const row = sheet.getRow(i);
            if (!row.getCell(1).value && !row.getCell(2).value) continue;

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
            if (!amount || amount <= 0) { if (amountCell) errors.push(`Brs ${i}: Nominal invalid.`); continue; }

            // MAPPING UNIT (STRICT)
            const unitData = unitMap.get(normalize(unitCell as string));
            if (!unitData) {
                errors.push(`Brs ${i}: Unit Bisnis '${unitCell}' tidak ditemukan.`);
                continue;
            }

            // MAPPING ACCOUNT
            const dStr = normalize(debitCell as string);
            const cStr = normalize(creditCell as string);

            // --- SMART MAPPING LOGIC ---
            // 1. Identify Existing
            let dBank = accMap.get(dStr) || localAccMap.get(dStr);
            let cBank = accMap.get(cStr) || localAccMap.get(cStr);
            let dCoa = coaMap.get(dStr) || localCoaMap.get(dStr);
            let cCoa = coaMap.get(cStr) || localCoaMap.get(cStr);

            let type: 'IN' | 'OUT' | null = null;
            let accountId: string | null = null;
            let coaId: string | null = null;
            let accountName = '';
            let categoryName = '';

            // Heuristic for NEW discovery
            const isLikelyBank = (s: string) => {
                const n = s.toLowerCase();
                return n.includes('bank') || n.includes('kas ') || n.includes(' kas') || n.startsWith('120') || n.startsWith('110');
            };

            // CASE A: Bank to COA (IN)
            if (dBank || (isLikelyBank(debitCell as string) && !cBank && !dCoa)) {
                if (!dBank && debitCell) {
                    // Create Bank
                    const newAcc = await prisma.financialAccount.create({
                        data: {
                            id: Math.random().toString(36).substr(2, 9),
                            tenantId,
                            name: debitCell.toString(),
                            bankName: 'Auto-Created',
                            accountNumber: '-',
                            balance: 0
                        }
                    });
                    dBank = newAcc;
                    accMap.set(normalize(newAcc.name), newAcc);
                    localAccMap.set(normalize(newAcc.name), newAcc);
                }
                type = 'IN';
                accountId = dBank.id;
                accountName = dBank.name;

                if (cCoa) {
                    coaId = cCoa.id;
                    categoryName = `${cCoa.code} - ${cCoa.name}`;
                } else if (creditCell) {
                    // Create COA
                    const newCoa = await prisma.chartOfAccount.create({
                        data: {
                            id: Math.random().toString(36).substr(2, 9),
                            tenantId,
                            code: (600000 + Math.floor(Math.random() * 10000)).toString(),
                            name: creditCell.toString(),
                            type: 'INCOME', // Standard for Bank to COA (IN)
                            normalPos: 'CREDIT'
                        }
                    });
                    coaMap.set(normalize(newCoa.name), newCoa);
                    localCoaMap.set(normalize(newCoa.name), newCoa);
                    coaId = newCoa.id;
                    categoryName = `${newCoa.code} - ${newCoa.name}`;
                }
            }
            // CASE B: COA to Bank (OUT)
            else if (cBank || (isLikelyBank(creditCell as string) && !dBank && !cCoa)) {
                if (!cBank && creditCell) {
                    const newAcc = await prisma.financialAccount.create({
                        data: {
                            id: Math.random().toString(36).substr(2, 9),
                            tenantId,
                            name: creditCell.toString(),
                            bankName: 'Auto-Created',
                            accountNumber: '-',
                            balance: 0
                        }
                    });
                    cBank = newAcc;
                    accMap.set(normalize(newAcc.name), newAcc);
                    localAccMap.set(normalize(newAcc.name), newAcc);
                }
                type = 'OUT';
                accountId = cBank.id;
                accountName = cBank.name;

                if (dCoa) {
                    coaId = dCoa.id;
                    categoryName = `${dCoa.code} - ${dCoa.name}`;
                } else if (debitCell) {
                    const newCoa = await prisma.chartOfAccount.create({
                        data: {
                            id: Math.random().toString(36).substr(2, 9),
                            tenantId,
                            code: (500000 + Math.floor(Math.random() * 10000)).toString(),
                            name: debitCell.toString(),
                            type: 'EXPENSE', // Standard for COA to Bank (OUT)
                            normalPos: 'DEBIT'
                        }
                    });
                    coaMap.set(normalize(newCoa.name), newCoa);
                    localCoaMap.set(normalize(newCoa.name), newCoa);
                    coaId = newCoa.id;
                    categoryName = `${newCoa.code} - ${newCoa.name}`;
                }
            }
            // CASE C: General Journal (COA to COA)
            else if (debitCell && creditCell) {
                type = 'IN'; // Standard for General Journal representation
                accountId = null;

                // Debit Side
                if (dCoa) {
                    accountName = `${dCoa.code} - ${dCoa.name}`;
                } else {
                    const newCoa = await prisma.chartOfAccount.create({
                        data: {
                            id: Math.random().toString(36).substr(2, 9),
                            tenantId,
                            code: (400000 + Math.floor(Math.random() * 10000)).toString(),
                            name: debitCell.toString(),
                            type: 'ASSET'
                        }
                    });
                    coaMap.set(normalize(newCoa.name), newCoa);
                    localCoaMap.set(normalize(newCoa.name), newCoa);
                    accountName = `${newCoa.code} - ${newCoa.name}`;
                }

                // Credit Side
                if (cCoa) {
                    coaId = cCoa.id;
                    categoryName = `${cCoa.code} - ${cCoa.name}`;
                } else {
                    const newCoa = await prisma.chartOfAccount.create({
                        data: {
                            id: Math.random().toString(36).substr(2, 9),
                            tenantId,
                            code: (500000 + Math.floor(Math.random() * 10000)).toString(),
                            name: creditCell.toString(),
                            type: 'LIABILITY'
                        }
                    });
                    coaMap.set(normalize(newCoa.name), newCoa);
                    localCoaMap.set(normalize(newCoa.name), newCoa);
                    coaId = newCoa.id;
                    categoryName = `${newCoa.code} - ${newCoa.name}`;
                }
            }

            if (!type) {
                errors.push(`Brs ${i}: Gagal memetakan akun '${debitCell}/${creditCell}'.`);
                continue;
            }

            const sNorm = normalize(descCell as string);
            // Unified Status mapping based on Description
            let finalStatus = 'PAID';
            if (sNorm.includes('dp')) {
                finalStatus = 'UNPAID';
            } else if (sNorm.includes('pelunasan')) {
                finalStatus = 'PAID';
            }
            // If explicit status column says otherwise, maybe respect it? 
            // The user said "kalo dp masuknya unpaid", so desc has priority.

            let finalDate = new Date();
            if (dateCell instanceof Date) finalDate = dateCell;
            else if (dateCell) { const p = new Date(dateCell.toString()); if (!isNaN(p.getTime())) finalDate = p; }
            datesFound.push(finalDate);

            rowsToProcess.push({
                date: finalDate, amount, type, desc: descCell?.toString() || `Import Brs ${i}`,
                accountId, coaId, businessUnitId: unitData.id, status: finalStatus, account: accountName, category: categoryName || 'Import'
            });
        }

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

                    // ALWAYS UPDATE BANK/CASH BALANCE (Even for UNPAID/DP)
                    if (row.accountId) {
                        const change = row.type === 'IN' ? row.amount : -row.amount;
                        await (tx as any).financialAccount.update({
                            where: { id: row.accountId },
                            data: { balance: { increment: change } }
                        });
                    }
                    importedCount++;
                }
            }, { timeout: 30000 });
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
