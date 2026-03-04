
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import ExcelJS from 'exceljs';
import { authorize } from '@/lib/auth';

export async function GET() {
  try {
    // 1. Authorize User
    const user = await authorize(['OWNER', 'FINANCE']);
    const { tenantId } = user;

    const workbook = new ExcelJS.Workbook();

    // --- SHEET 1: PANDUAN (User Experience) ---
    const helpSheet = workbook.addWorksheet('CARA ISI PANDUAN');
    helpSheet.getCell('A1').value = 'PANDUAN PENGISIAN IMPORT ARUS KAS SDM ERP';
    helpSheet.getCell('A1').font = { bold: true, size: 14 };

    const helpData = [
      ['KASUS (TRANSAKSI)', 'PENJELASAN SINGKAT', 'SISI DEBET (PENERIMA)', 'SISI KREDIT (PEMBERI)', 'STATUS'],
      ['Uang Masuk (Omzet)', 'Pendapatan masuk ke Bank/Kas', 'Pilih Nama Bank (e.g. Bank BCA)', 'Pilih Akun Pendapatan (e.g. 411-Penjualan)', 'PAID'],
      ['Uang Keluar (Beban)', 'Membayar biaya operasional', 'Pilih Akun Biaya (e.g. 511-Listrik)', 'Pilih Nama Bank Pengirim (e.g. Kas Kecil)', 'PAID'],
      ['Jurnal Umum (Memorial)', 'Penyesuaian antar akun non-kas', 'Pilih Akun yang Bertambah', 'Pilih Akun yang Berkurang', 'PAID'],
      ['Piutang (Penjualan)', 'Penjualan tapi belum dibayar', 'Pilih Akun Piutang Usaha', 'Pilih Akun Pendapatan', 'UNPAID'],
    ];

    helpData.forEach((row, i) => {
      const r = helpSheet.addRow(row);
      if (i === 0) {
        r.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        r.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
      }
    });

    // ... column widths stay similar ...

    // --- SHEET 2: TEMPLATE UTAMA ---
    const sheet = workbook.addWorksheet('Template Import');
    sheet.columns = [
      { header: 'TANGGAL (DD/MM/YYYY)', key: 'date', width: 22 },
      { header: 'KETERANGAN / DESKRIPSI', key: 'desc', width: 40 },
      { header: 'AKUN DEBET', key: 'debit', width: 35 },
      { header: 'AKUN KREDIT', key: 'credit', width: 35 },
      { header: 'NOMINAL (JUMLAH)', key: 'amount', width: 18 },
      { header: 'UNIT BISNIS', key: 'unit', width: 18 },
      { header: 'STATUS', key: 'status', width: 12 },
    ];

    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };

    // --- SHEET 3: REFERENSI (Otomatis dari DB) ---
    // Fix typo: Referuensi -> Referensi
    const refSheet = workbook.addWorksheet('Referensi');
    const accounts = await prisma.financialAccount.findMany({
      where: { tenantId, isActive: true }
    });
    const coas = await prisma.chartOfAccount.findMany({
      where: { tenantId, isActive: true }
    });
    const units = await prisma.businessUnit.findMany({
      where: { tenantId, isActive: true }
    });

    // GABUNGKAN AKUN BANK & COA DALAM SATU LIST (MASTER LIST)
    refSheet.getCell('A1').value = 'MASTER AKUN (BANK + COA)';
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
    const masterListRange = `Referensi!$A$2:$A$${rowIdx - 1}`;
    const unitRange = `Referensi!$B$2:$B$${units.length + 1}`;
    const statusRange = `Referensi!$C$2:$C$3`;

    for (let i = 2; i <= 500; i++) {
      sheet.getCell(`C${i}`).dataValidation = { type: 'list', allowBlank: true, formulae: [masterListRange] };
      sheet.getCell(`D${i}`).dataValidation = { type: 'list', allowBlank: true, formulae: [masterListRange] };
      sheet.getCell(`F${i}`).dataValidation = { type: 'list', allowBlank: true, formulae: [unitRange] };
      sheet.getCell(`G${i}`).dataValidation = { type: 'list', allowBlank: true, formulae: [statusRange] };
    }

    // Set Column A as Date format
    sheet.getColumn(1).numFmt = 'dd/mm/yyyy';

    // Example Row
    sheet.addRow(['20/01/2026', 'Membayar Listrik', coas[0] ? `${coas[0].code} - ${coas[0].name}` : '511 - Beban Listrik', accounts[0] ? `${accounts[0].bankName} - ${accounts[0].name}` : 'BCA - Operasional', '250000', units[0]?.name || 'SDM', 'PAID']);

    const buffer = await workbook.xlsx.writeBuffer();
    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename=Template_ArusKas_SDM_ERP.xlsx',
      },
    });

  } catch (error: any) {
    console.error('Template Error:', error);
    return NextResponse.json({ error: error.message || 'Gagal generate template' }, { status: error.status || 500 });
  }
}
