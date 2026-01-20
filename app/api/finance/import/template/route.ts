
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import ExcelJS from 'exceljs';

export async function GET() {
  try {
    const workbook = new ExcelJS.Workbook();
    
    // --- SHEET 1: PANDUAN (User Experience) ---
    const helpSheet = workbook.addWorksheet('CARA ISI PANDUAN');
    helpSheet.getCell('A1').value = 'PANDUAN PENGISIAN IMPORT ARUS KAS SDM ERP';
    helpSheet.getCell('A1').font = { bold: true, size: 14 };
    
    const helpData = [
      ['KASUS', 'PENJELASAN', 'AKUN DEBET', 'AKUN KREDIT', 'STATUS'],
      ['Uang Masuk (Omzet)', 'Pendapatan masuk ke Bank', 'Pilih Nama Bank (e.g. Bank BCA)', 'Pilih Kategori (e.g. 411-Penjualan)', 'PAID'],
      ['Uang Keluar (Beban)', 'Membayar biaya/pengeluaran', 'Pilih Kategori (e.g. 511-Beban Gaji)', 'Pilih Nama Bank (e.g. Kas Kecil)', 'PAID'],
      ['Piutang (Belum Lunas)', 'Mencatat penjualan tapi uang belum diterima', 'Pilih Nama Bank (Penampung)', 'Pilih Kategori Pendapatan', 'UNPAID'],
      ['Transfer Antar Kas', 'Pindah uang antar bank (Internal)', 'Pilih Bank Penerima', 'Pilih Bank Pengirim', 'PAID'],
    ];

    helpData.forEach((row, i) => {
        const r = helpSheet.addRow(row);
        if (i === 0) r.font = { bold: true };
    });
    helpSheet.getColumn(1).width = 25;
    helpSheet.getColumn(2).width = 45;
    helpSheet.getColumn(3).width = 25;
    helpSheet.getColumn(4).width = 25;
    helpSheet.getColumn(5).width = 15;

    // --- SHEET 2: TEMPLATE UTAMA ---
    const sheet = workbook.addWorksheet('Template Import');
    sheet.columns = [
      { header: 'TANGGAL', key: 'date', width: 15 },
      { header: 'KETERANGAN', key: 'desc', width: 35 },
      { header: 'AKUN DEBET', key: 'debit', width: 30 },
      { header: 'AKUN KREDIT', key: 'credit', width: 30 },
      { header: 'NOMINAL', key: 'amount', width: 15 },
      { header: 'UNIT', key: 'unit', width: 15 },
      { header: 'STATUS', key: 'status', width: 12 },
    ];

    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };

    // --- SHEET 3: REFERENSI (Otomatis dari DB) ---
    const refSheet = workbook.addWorksheet('Referuensi');
    const accounts = await prisma.financialAccount.findMany({ where: { isActive: true } });
    const coas = await prisma.chartOfAccount.findMany({ where: { isActive: true } });
    const units = await prisma.businessUnit.findMany();

    // GABUNGKAN AKUN BANK & COA DALAM SATU LIST (MASTER LIST)
    refSheet.getCell('A1').value = 'MASTER AKU (BANK + COA)';
    let rowIdx = 2;
    accounts.forEach(acc => {
        refSheet.getCell(`A${rowIdx++}`).value = `${acc.bankName} - ${acc.name}`;
    });
    coas.forEach(coa => {
        refSheet.getCell(`A${rowIdx++}`).value = `${coa.code} - ${coa.name}`;
    });

    refSheet.getCell('B1').value = 'DAFTAR UNIT';
    units.forEach((u, i) => { refSheet.getCell(`B${i + 2}`).value = u.name; });

    refSheet.getCell('C1').value = 'STATUS';
    refSheet.getCell('C2').value = 'PAID';
    refSheet.getCell('C3').value = 'UNPAID';

    // --- DATA VALIDATION (SMART DROPDOWN) ---
    const masterListRange = `Referuensi!$A$2:$A$${rowIdx - 1}`;
    const unitRange = `Referuensi!$B$2:$B$${units.length + 1}`;
    const statusRange = `Referuensi!$C$2:$C$3`;

    for (let i = 2; i <= 500; i++) {
        // Debet & Kredit sekarang bisa pilih SEMUA AKUN (Uang masuk/keluar ga bakal bingung)
        sheet.getCell(`C${i}`).dataValidation = { type: 'list', allowBlank: true, formulae: [masterListRange] };
        sheet.getCell(`D${i}`).dataValidation = { type: 'list', allowBlank: true, formulae: [masterListRange] };
        sheet.getCell(`F${i}`).dataValidation = { type: 'list', allowBlank: true, formulae: [unitRange] };
        sheet.getCell(`G${i}`).dataValidation = { type: 'list', allowBlank: true, formulae: [statusRange] };
    }

    // Example
    sheet.addRow(['20/01/2026', 'Membayar Listrik', '511 - Beban Listrik', 'BCA - Operasional', '250000', 'SDM', 'PAID']);

    const buffer = await workbook.xlsx.writeBuffer();
    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename=Template_ArusKas_PRO_V3.xlsx',
      },
    });

  } catch (error) {
    console.error('Template Error:', error);
    return NextResponse.json({ error: 'Gagal' }, { status: 500 });
  }
}
