import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';

export async function GET() {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Template COA');

    sheet.columns = [
        { header: 'KODE AKUN', key: 'code', width: 15 },
        { header: 'NAMA AKUN', key: 'name', width: 30 },
        { header: 'TIPE (OPSIONAL)', key: 'type', width: 25 },
        { header: 'POSISI NORMAL (OPSIONAL)', key: 'normalPos', width: 25 },
        { header: 'KETERANGAN', key: 'description', width: 40 }
    ];

    // Add sample rows
    sheet.addRow(['110001', 'Kas Kecil', 'ASSET', 'DEBIT', 'Dana kas kecil kantor']);
    sheet.addRow(['410001', 'Pendapatan Jasa', 'INCOME', 'CREDIT', 'Pendapatan dari layanan']);
    sheet.addRow(['510001', 'Beban Listrik', 'EXPENSE', 'DEBIT', 'Biaya listrik bulanan']);

    // Styling
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

    const buffer = await workbook.xlsx.writeBuffer();

    return new Response(buffer, {
        headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': 'attachment; filename=Template_Import_COA.xlsx'
        }
    });
}
