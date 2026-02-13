
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

            // Define Headers
            const headers = [
                { header: 'Tanggal (YYYY-MM-DD)', key: 'date', width: 20 },
                { header: 'Nama Customer', key: 'customer', width: 25 },
                { header: 'Unit (PS 3/4)', key: 'unit', width: 15 },
                { header: 'Durasi (Jam)', key: 'duration', width: 12 },
                { header: 'Nominal Cash', key: 'cashAmount', width: 15 },
                { header: 'Nominal Transfer', key: 'transferAmount', width: 15 },
                { header: 'Total Nominal', key: 'totalAmount', width: 15 },
                { header: 'Metode (CASH/TF/SPLIT)', key: 'paymentMethod', width: 22 },
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
            const sampleRow = worksheet.addRow({
                date: new Date().toISOString().split('T')[0],
                customer: 'Contoh Budi',
                unit: 'PS 4',
                duration: 2,
                cashAmount: 20000,
                transferAmount: 0,
                totalAmount: 20000,
                paymentMethod: 'CASH',
                outlet: outletNames[0] || 'Utama',
                petugas: user.name
            });

            // Add Data Validations (Dropdowns)
            // 1. Column C (Unit)
            for (let i = 2; i <= 500; i++) {
                worksheet.getCell(`C${i}`).dataValidation = {
                    type: 'list',
                    allowBlank: true,
                    formulae: ['"PS 3,PS 4,PS 5,PC,LAINNYA"'],
                    showErrorMessage: true,
                    errorTitle: 'Input Salah',
                    error: 'Silakan pilih tipe unit dari daftar'
                };

                // 2. Column H (Payment Method)
                worksheet.getCell(`H${i}`).dataValidation = {
                    type: 'list',
                    allowBlank: true,
                    formulae: ['"CASH,TRANSFER,SPLIT"'],
                    showErrorMessage: true,
                    error: 'Silakan pilih metode yang tersedia'
                };

                // 3. Column I (Outlet Dropdown from DB)
                if (outletNames.length > 0) {
                    worksheet.getCell(`I${i}`).dataValidation = {
                        type: 'list',
                        allowBlank: true,
                        formulae: [`"${outletNames.join(',')}"`],
                        showErrorMessage: true,
                        errorTitle: 'Outlet Tidak Dikenal',
                        error: 'Silakan pilih outlet yang terdaftar'
                    };
                }
            }

            // Instructions Sheet
            const helpSheet = workbook.addWorksheet('Panduan');
            helpSheet.addRow(['PANDUAN IMPORT DATA RENTAL PS']);
            helpSheet.addRow(['1. Gunakan format tanggal YYYY-MM-DD (Misal: 2026-02-12).']);
            helpSheet.addRow(['2. Pilih Outlet dari dropdown agar data masuk ke cabang yang benar.']);
            helpSheet.addRow(['3. Untuk bayar SPLIT, isi kolom Nominal Cash DAN Nominal Transfer.']);
            helpSheet.addRow(['4. Total Nominal adalah jumlah akhir yang harus dibayar.']);
            helpSheet.addRow(['5. Nomor Nota akan dibuat otomatis oleh sistem (LUG-Tahun-Bulan-Sequence).']);

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
