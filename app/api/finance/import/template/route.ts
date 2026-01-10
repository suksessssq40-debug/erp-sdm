
import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

export async function GET() {
  try {
    // 1. Define Headers Matches Finance Expectations
    const headers = ['TANGGAL', 'KETERANGAN', 'AKUN_DEBET', 'AKUN_KREDIT', 'NOMINAL'];
    
    // 2. Add Sample Data (Guide)
    const data = [
      {
        TANGGAL: '2026-01-10', 
        KETERANGAN: 'Contoh: Terima Pembayaran Customer', 
        AKUN_DEBET: 'Bank BCA', // Bank kita di Debit = UANG MASUK
        AKUN_KREDIT: '411000 - Penjualan', 
        NOMINAL: 5000000
      },
      {
        TANGGAL: '2026-01-10', 
        KETERANGAN: 'Contoh: Bayar Listrik', 
        AKUN_DEBET: '603100 - Beban Listrik', 
        AKUN_KREDIT: 'Bank BCA', // Bank kita di Kredit = UANG KELUAR
        NOMINAL: 750000
      }
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data, { header: headers });

    // Auto-width columns
    const wscols = [
        {wch: 15}, // Tanggal
        {wch: 40}, // Ket
        {wch: 30}, // Debet
        {wch: 30}, // Kredit
        {wch: 15}, // Nominal
    ];
    ws['!cols'] = wscols;

    XLSX.utils.book_append_sheet(wb, ws, "Template_Import");

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Disposition': 'attachment; filename="template_import_transaksi.xlsx"',
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to generate template' }, { status: 500 });
  }
}
