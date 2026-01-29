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

        const sheet = workbook.getWorksheet(1);
        if (!sheet || sheet.actualRowCount <= 1) {
            return NextResponse.json({ error: 'File kosong atau tidak valid.' }, { status: 400 });
        }

        const coasToImport: any[] = [];
        const errors: string[] = [];

        // Safety map to avoid duplicates in the SAME Excel file
        const seenCodes = new Set();

        // Skip header row
        for (let i = 2; i <= sheet.rowCount; i++) {
            const row = sheet.getRow(i);
            const code = row.getCell(1).value?.toString().trim();
            const name = row.getCell(2).value?.toString().trim();
            let type = row.getCell(3).value?.toString().trim().toUpperCase(); // Optional
            let normalPos = row.getCell(4).value?.toString().trim().toUpperCase(); // Optional
            const description = row.getCell(5).value?.toString().trim();

            if (!code || !name) {
                if (code || name) errors.push(`Brs ${i}: Kode dan Nama wajib diisi.`);
                continue;
            }

            // --- ACCOUNTING INTELLIGENCE ENGINE ---
            // If type or normalPos is missing, detect based on the first digit of the code
            if (!type || type === '') {
                const firstDigit = code[0];
                switch (firstDigit) {
                    case '1': type = 'ASSET'; break;
                    case '2': type = 'LIABILITY'; break;
                    case '3': type = 'EQUITY'; break;
                    case '4': type = 'INCOME'; break;
                    case '5': case '6': case '7': case '8': case '9': type = 'EXPENSE'; break;
                    default: type = 'ASSET'; // Fallback
                }
            }

            if (!normalPos || normalPos === '') {
                // Asset (1) and Expense (5-9) are usually DEBIT. Others are CREDIT.
                if (type === 'ASSET' || type === 'EXPENSE') {
                    normalPos = 'DEBIT';
                } else {
                    normalPos = 'CREDIT';
                }
            }

            if (seenCodes.has(code)) {
                errors.push(`Brs ${i}: Duplicate Kode '${code}' dalam satu file Excel. Baris ini dilewati.`);
                continue;
            }
            seenCodes.add(code);

            // Validate type after auto-detection
            const validTypes = ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE'];
            if (!validTypes.includes(type)) {
                errors.push(`Brs ${i}: Tipe '${type}' tidak valid. Gunakan: ${validTypes.join(', ')}`);
                continue;
            }

            coasToImport.push({
                code,
                name,
                type,
                normalPos: normalPos,
                description: description || '',
                tenantId,
                isActive: true
            });
        }

        if (coasToImport.length === 0) {
            return NextResponse.json({ error: 'Tidak ada data valid untuk diimport.', details: errors }, { status: 400 });
        }

        // Atomic Upsert
        let successCount = 0;
        await prisma.$transaction(async (tx) => {
            for (const coa of coasToImport) {
                const id = `coa_${coa.code.toLowerCase()}_${tenantId}`;
                await tx.chartOfAccount.upsert({
                    where: {
                        tenantId_code: {
                            tenantId: coa.tenantId,
                            code: coa.code
                        }
                    },
                    update: {
                        name: coa.name,
                        type: coa.type,
                        normalPos: coa.normalPos,
                        description: coa.description,
                        isActive: true
                    },
                    create: {
                        id,
                        ...coa,
                        createdAt: BigInt(Date.now())
                    }
                });
                successCount++;
            }
        });

        return NextResponse.json({
            success: true,
            message: `Berhasil mengimport ${successCount} akun (COA).`,
            errors: errors.length > 0 ? errors : undefined
        });

    } catch (error: any) {
        console.error('COA IMPORT ERROR:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
