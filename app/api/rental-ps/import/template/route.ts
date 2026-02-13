
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorize } from '@/lib/auth';
import ExcelJS from 'exceljs';

export async function GET(request: Request) {
    try {
        const user = await authorize(['OWNER', 'MANAGER', 'FINANCE', 'STAFF']);
        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type');

        if (type === 'template') {
            const outlets = await prisma.rentalPsOutlet.findMany({
                where: { tenantId: user.tenantId, isActive: true },
                select: { name: true }
            });

            const outletNames = outlets.map(o => o.name);

            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Import Rental PS');

            // Define Headers (Simplified & Smarter)
            const headers = [
                { header: 'Tanggal (YYYY-MM-DD)', key: 'date', width: 20 },
                { header: 'Nama Customer', key: 'customer', width: 25 },
                { header: 'Unit (PS 3/4)', key: 'unit', width: 15 },
                { header: 'Durasi (Jam)', key: 'duration', width: 12 },
                { header: 'Nominal Tunai (CASH)', key: 'cashAmount', width: 20 },
                { header: 'Nominal Transfer (BANK)', key: 'transferAmount', width: 25 },
                { header: 'Outlet', key: 'outlet', width: 20 },
                { header: 'Petugas', key: 'petugas', width: 15 }
            ];

            worksheet.columns = headers;

            // Add Formatting to Header
            worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
            worksheet.getRow(1).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF1E293B' } // Slate-800
            };
            worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

            // Add Sample Row
            worksheet.addRow({
                date: new Date().toISOString().split('T')[0],
                customer: 'Budi Darmawan',
                unit: 'PS 4',
                duration: 2,
                cashAmount: 20000,
                transferAmount: 0,
                outlet: outletNames[0] || 'Utama',
                petugas: user.name
            });

            // Add Data Validations (Dropdowns)
            for (let i = 2; i <= 500; i++) {
                // 1. Column C (Unit)
                worksheet.getCell(`C${i}`).dataValidation = {
                    type: 'list',
                    allowBlank: true,
                    formulae: ['"PS 3,PS 4,PS 5,PC,LAINNYA"'],
                    showErrorMessage: true,
                    errorTitle: 'Input Salah',
                    error: 'Silakan pilih tipe unit dari daftar'
                };

                // 2. Column G (Outlet Dropdown from DB)
                if (outletNames.length > 0) {
                    worksheet.getCell(`G${i}`).dataValidation = {
                        type: 'list',
                        allowBlank: true,
                        formulae: [`"${outletNames.join(',')}"`],
                        showErrorMessage: true,
                        errorTitle: 'Outlet Tidak Dikenal',
                        error: 'Silakan pilih outlet yang terdaftar'
                    };
                }

                // Currency formatting for cash/transfer
                worksheet.getCell(`E${i}`).numFmt = '#,##0';
                worksheet.getCell(`F${i}`).numFmt = '#,##0';
            }

            // Instructions Sheet
            const helpSheet = workbook.addWorksheet('Panduan');
            helpSheet.getColumn(1).width = 80;
            helpSheet.addRow(['PANDUAN IMPORT DATA RENTAL PS (VERSION 2.0)']).font = { bold: true, size: 14 };
            helpSheet.addRow(['']);
            helpSheet.addRow(['1. TANGGAL: Gunakan format YYYY-MM-DD (Contoh: 2026-02-12).']);
            helpSheet.addRow(['2. OUTLET: Wajib pilih dari dropdown agar laporan keuangan cabang akurat.']);
            helpSheet.addRow(['3. SISTEM CERDAS PEMBAYARAN:']);
            helpSheet.addRow(['   - Jika isi kolom TUNAI saja -> Otomatis metode CASH']);
            helpSheet.addRow(['   - Jika isi kolom TRANSFER saja -> Otomatis metode TRANSFER']);
            helpSheet.addRow(['   - Jika isi Keduanya -> Otomatis metode SPLIT']);
            helpSheet.addRow(['4. TOTAL NOMINAL: Tidak perlu diisi, sistem akan menjumlahkan TUNAI + TRANSFER secara otomatis.']);
            helpSheet.addRow(['5. NO. NOTA (INVOICE): Akan dibuat otomatis mengikuti urutan romawi terbaru (LUG-Year-Month-Sequence).']);

            const buffer = await workbook.xlsx.writeBuffer();

            return new Response(buffer, {
                headers: {
                    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'Content-Disposition': 'attachment; filename=Template_Import_Rental_PS.xlsx'
                }
            });
        }

        return NextResponse.json({ error: 'Action not found' }, { status: 404 });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
