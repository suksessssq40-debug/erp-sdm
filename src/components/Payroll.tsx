
import React, { useState, useMemo, useEffect } from 'react';
import { User, UserRole, UserSalaryConfig, PayrollRecord, Attendance, AppSettings } from '../types';
import { formatCurrency, sendTelegramDocument } from '../utils';
import {
  CreditCard,
  Users,
  Send,
  Eye,
  History as HistoryIcon,
  User as UserIcon,
  Calculator,
  X,
  Printer,
  FileCheck,
  Building,
  CheckCircle2,
  Zap
} from 'lucide-react';
import { useToast } from './Toast';

declare var jspdf: any;

interface PayrollProps {
  currentUser: User;
  users: User[];
  salaryConfigs: UserSalaryConfig[];
  attendance: Attendance[];
  settings: AppSettings;
  payrollRecords: PayrollRecord[];
  onUpdateSalary: (config: UserSalaryConfig) => void;
  onAddPayroll: (record: PayrollRecord) => void;
  toast: ReturnType<typeof useToast>;
}

const PayrollModule: React.FC<PayrollProps> = ({
  currentUser, users, salaryConfigs, settings, payrollRecords, onAddPayroll, toast
}) => {
  const [activeTab, setActiveTab] = useState<'MANAGEMENT' | 'HISTORY'>('MANAGEMENT');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);

  // Manual Input State
  const [form, setForm] = useState({
    basicSalary: 0,
    allowance: 0, // Insentif Kehadiran
    bonus: 0,
    totalHadir: 0,
    totalIzin: 0,
    dailyRate: 0,
    deductions: 0,
    notes: ''
  });

  // Calculate THP
  const netSalary = (form.basicSalary + form.allowance + form.bonus) - form.deductions;

  // Filter out owners and sort users
  const filteredUsers = useMemo(() => {
    return users.filter(u => u.role !== UserRole.OWNER).sort((a, b) => a.name.localeCompare(b.name));
  }, [users]);

  // Handle User Selection
  const handleSelectUser = (user: User) => {
    setSelectedUser(user);
    const config = salaryConfigs.find(c => c.userId === user.id);
    if (config) {
      setForm({
        ...form,
        basicSalary: config.basicSalary || 0,
        allowance: config.allowance || 0,
        dailyRate: 0,
        totalHadir: 0,
        totalIzin: 0,
        bonus: 0,
        deductions: 0,
        notes: ''
      });
    } else {
      setForm({
        basicSalary: 0,
        allowance: 0,
        bonus: 0,
        totalHadir: 0,
        totalIzin: 0,
        dailyRate: 0,
        deductions: 0,
        notes: ''
      });
    }
  };

  const generatePDF = async (user: User, record: PayrollRecord) => {
    if (!(window as any).jspdf) {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
      document.head.appendChild(script);
      await new Promise(resolve => script.onload = resolve);
    }

    const { jsPDF } = (window as any).jspdf;
    const doc = new jsPDF();
    const p = settings.companyProfile || { name: 'COMPANY NAME', address: 'ADDRESS', phone: '000' };

    const pageWidth = 210;
    const margin = 15;
    let currentY = 15;

    // --- HEADER ---
    if (p.logoUrl) {
      try { doc.addImage(p.logoUrl, 'PNG', margin, currentY, 25, 20); } catch (e) { }
    }

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text(p.name.toUpperCase(), margin + 30, currentY + 5);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    const addressLines = doc.splitTextToSize(p.address, 100);
    doc.text(addressLines, margin + 30, currentY + 10);

    // Month Badge
    doc.setFillColor(186, 212, 245);
    doc.rect(150, currentY, 45, 8, 'F');
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    const monthName = new Date(record.month + '-01').toLocaleString('en-US', { month: 'long', year: 'numeric' });
    doc.text(monthName, 172.5, currentY + 5.5, { align: 'center' });

    currentY += 25;
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.8);
    doc.line(margin, currentY, pageWidth - margin, currentY);

    currentY += 10;

    // --- USER INFO ---
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.text('NAMA KARYAWAN', margin, currentY);
    doc.text('JABATAN', margin, currentY + 7);

    doc.setFont('helvetica', 'bold');
    doc.text(`:  ${user.name.toUpperCase()}`, margin + 45, currentY);
    doc.text(`:  ${user.role.toUpperCase()}`, margin + 45, currentY + 7);

    currentY += 12;

    // --- TABLE HEADERS ---
    doc.setFillColor(186, 212, 245);
    doc.rect(margin, currentY, 90, 8, 'F');
    doc.rect(margin + 90, currentY, 90, 8, 'F');

    doc.setFont('helvetica', 'bold');
    doc.text('PENDAPATAN', margin + 2, currentY + 5.5);
    doc.text(':', margin + 45, currentY + 5.5);
    doc.text('POTONGAN', margin + 92, currentY + 5.5);
    doc.text(':', margin + 135, currentY + 5.5);

    currentY += 8;

    const startTableY = currentY;
    const row = (label: string, value: string | number, y: number, isLeft: boolean) => {
      doc.setFont('helvetica', 'normal');
      doc.text(label, isLeft ? margin + 2 : margin + 92, y);
      doc.text(':', isLeft ? margin + 45 : margin + 135, y);
      const valStr = typeof value === 'number' ? `Rp  ${value.toLocaleString('id-ID')}` : value.toString();
      doc.text(valStr, isLeft ? margin + 70 : margin + 160, y);
    };

    let ly = startTableY + 8;
    row('GAJI POKOK', record.basicSalary, ly, true);
    ly += 7;
    row('INSENTIF KEHADIRAN', record.allowance, ly, true);
    ly += 7;
    if (record.bonus > 0) {
      row('BONUS', record.bonus, ly, true);
      ly += 7;
    }

    let ry = startTableY + 8;
    row('KEHADIRAN', `${record.metadata?.totalHadir || 0} Hari`, ry, false);
    ry += 7;
    row('JUMLAH IZIN', `${record.metadata?.totalIzin || 0} Hari`, ry, false);
    ry += 7;
    row('GAJI/HARI', record.metadata?.dailyRate || 0, ry, false);
    ry += 7;
    row('POTONGAN*', record.deductions, ry, false);
    ry += 7;

    currentY = Math.max(ly, ry) + 5;

    // --- TOTAL BOXES ---
    doc.setFillColor(186, 212, 245);
    doc.rect(margin, currentY, 90, 8, 'F');
    doc.rect(margin + 90, currentY, 90, 8, 'F');

    doc.setFont('helvetica', 'bold');
    doc.text('JML PENDAPATAN', margin + 2, currentY + 5.5);
    doc.text(':', margin + 45, currentY + 5.5);
    doc.text(`Rp  ${(record.basicSalary + record.allowance + record.bonus).toLocaleString('id-ID')}`, margin + 70, currentY + 5.5);

    doc.text('JML POTONGAN', margin + 92, currentY + 5.5);
    doc.text(':', margin + 135, currentY + 5.5);
    doc.text(`Rp  ${record.deductions.toLocaleString('id-ID')}`, margin + 160, currentY + 5.5);

    currentY += 15;

    // --- FOOTER & BANK INFO ---
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('NB: -', margin, currentY);
    if (record.metadata?.notes) {
      doc.text(record.metadata.notes, margin + 8, currentY);
    }

    doc.text('Gaji dibayarkan ke rekening yang didaftarkan ke bagian keuangan', margin + 90, currentY);
    doc.text('yaitu:', margin + 90, currentY + 4);

    doc.text('Nomor Rekening', margin + 90, currentY + 10);
    doc.text(':', margin + 120, currentY + 10);
    doc.text(user.deviceIds?.[0] || '1710018428774 (Bank Mandiri)', margin + 125, currentY + 10);

    doc.text('Nama Rekening', margin + 90, currentY + 15);
    doc.text(':', margin + 120, currentY + 15);
    doc.text(user.name.toUpperCase(), margin + 125, currentY + 15);

    currentY += 25;

    // --- FINAL TOTAL BAR ---
    doc.setFillColor(30, 58, 138);
    doc.rect(margin, currentY, 90, 10, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('GAJI BERSIH', margin + 2, currentY + 6.5);
    doc.text(':', margin + 45, currentY + 6.5);
    doc.text(`Rp  ${record.netSalary.toLocaleString('id-ID')}`, margin + 55, currentY + 6.5);

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(9);
    const dateFooter = `Kediri, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`;
    doc.text(dateFooter, 150, currentY + 6.5);

    currentY += 18;
    doc.setFont('helvetica', 'bold');
    doc.text('Tim Keuangan', 160, currentY, { align: 'center' });

    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(1);
    doc.line(margin, 280, pageWidth - margin, 280);

    return doc.output('blob');
  };

  const handlePreview = async () => {
    if (!selectedUser) return;
    const record: PayrollRecord = {
      id: 'preview',
      userId: selectedUser.id,
      month: selectedMonth,
      basicSalary: form.basicSalary,
      allowance: form.allowance,
      totalMealAllowance: 0,
      bonus: form.bonus,
      deductions: form.deductions,
      netSalary,
      isSent: false,
      processedAt: Date.now(),
      metadata: {
        totalHadir: form.totalHadir,
        totalTelat: 0,
        totalIzin: form.totalIzin,
        dailyRate: form.dailyRate,
        notes: form.notes
      }
    };
    const blob = await generatePDF(selectedUser, record);
    setPreviewBlob(blob);
  };

  const handleSend = async () => {
    if (!selectedUser || !settings.telegramBotToken) {
      toast.error("Pilih karyawan dan pastikan bot token terisi.");
      return;
    }

    if (!selectedUser.telegramId) {
      toast.error(`${selectedUser.name} tidak memiliki ID Telegram.`);
      return;
    }

    setIsProcessing(true);
    try {
      const record: PayrollRecord = {
        id: Math.random().toString(36).substr(2, 9),
        userId: selectedUser.id,
        month: selectedMonth,
        basicSalary: form.basicSalary,
        allowance: form.allowance,
        totalMealAllowance: 0,
        bonus: form.bonus,
        deductions: form.deductions,
        netSalary,
        isSent: true,
        processedAt: Date.now(),
        metadata: {
          totalHadir: form.totalHadir,
          totalTelat: 0,
          totalIzin: form.totalIzin,
          dailyRate: form.dailyRate,
          notes: form.notes
        }
      };

      const pdfBlob = await generatePDF(selectedUser, record);
      const periodLabel = new Date(selectedMonth + '-01').toLocaleString('id-ID', { month: 'long', year: 'numeric' });
      await sendTelegramDocument(
        settings.telegramBotToken,
        selectedUser.telegramId,
        pdfBlob,
        `Slip_${selectedUser.username}_${selectedMonth}.pdf`,
        `Selamat malam saudara ${selectedUser.name.toUpperCase()}\n\nTerima kasih atas dedikasi dan kinerja Anda di Sukses Digital Media.\nBerikut ini slip gaji bulan ${periodLabel} beserta bukti transfer ke rekening Anda. Silakan dicek dan jika ada pertanyaan hubungi bagian Keuangan.\n\nTerima Kasih.\n\nTertanda\nKeuangan Sukses Digital Media`
      );

      onAddPayroll(record);
      toast.success(`Slip gaji berhasil dikirim ke ${selectedUser.name}`);
      setPreviewBlob(null);
      setSelectedUser(null);
    } catch (e: any) {
      console.error(e);
      toast.error("Gagal mengirim slip: " + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20 max-w-7xl mx-auto">
      {/* Premium Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 bg-slate-900 p-12 rounded-[4rem] shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/20 blur-[100px] rounded-full -mr-32 -mt-32 animate-pulse"></div>
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/10 text-blue-400 rounded-full text-[10px] font-black uppercase tracking-widest mb-6 border border-blue-500/20">
            <Building size={12} /> Financial Administration
          </div>
          <h3 className="text-6xl font-black text-white tracking-tighter leading-none italic">Payroll <span className="text-blue-500">Center</span></h3>
          <p className="text-slate-400 font-bold mt-4 text-sm max-w-md">Input data payroll individu dan kirimkan slip gaji profesional melalui Telegram.</p>
        </div>
        <div className="flex items-center gap-4 relative z-10">
          <input
            type="month"
            className="p-5 bg-white/5 border-2 border-white/10 rounded-3xl font-black text-xs text-white outline-none focus:border-blue-500 focus:bg-white/10 transition-all shadow-xl"
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
          />
          <button
            onClick={() => setActiveTab(activeTab === 'MANAGEMENT' ? 'HISTORY' : 'MANAGEMENT')}
            className={`px-10 py-5 rounded-3xl text-[10px] font-black uppercase tracking-widest flex items-center transition-all shadow-2xl ${activeTab === 'MANAGEMENT' ? 'bg-blue-600 text-white hover:bg-white hover:text-blue-600' : 'bg-white text-slate-900'}`}
          >
            {activeTab === 'MANAGEMENT' ? <HistoryIcon className="mr-2" size={16} /> : <Users className="mr-2" size={16} />}
            {activeTab === 'MANAGEMENT' ? 'Lihat Riwayat' : 'Buat Slip Baru'}
          </button>
        </div>
      </div>

      {activeTab === 'MANAGEMENT' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white rounded-[3.5rem] shadow-xl border border-slate-100 overflow-hidden flex flex-col h-full">
              <div className="p-8 border-b bg-slate-50/30 flex items-center justify-between">
                <h4 className="font-black text-slate-800 text-xs uppercase tracking-widest italic flex items-center gap-2">
                  <Users size={14} className="text-blue-600" /> Pilih Karyawan
                </h4>
                <span className="bg-slate-100 text-slate-500 px-3 py-1 rounded-full text-[10px] font-black uppercase">{filteredUsers.length} TOTAL</span>
              </div>
              <div className="max-h-[600px] overflow-y-auto custom-scrollbar">
                {filteredUsers.map(user => (
                  <button
                    key={user.id}
                    onClick={() => handleSelectUser(user)}
                    className={`w-full text-left p-8 transition-all border-b border-slate-50 flex items-center gap-5 group ${selectedUser?.id === user.id ? 'bg-blue-600 text-white shadow-inner' : 'hover:bg-slate-50 text-slate-600'}`}
                  >
                    <div className={`w-14 h-14 rounded-3xl flex items-center justify-center font-black text-sm shadow-xl transition-transform group-hover:scale-110 ${selectedUser?.id === user.id ? 'bg-white/20' : 'bg-slate-900 text-white'}`}>
                      {user.avatarUrl ? (
                        <img src={user.avatarUrl} className="w-full h-full object-cover rounded-3xl" alt="" />
                      ) : (
                        user.name.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div>
                      <div className="font-black text-base">{user.name}</div>
                      <div className={`text-[11px] font-bold uppercase tracking-widest mt-1 opacity-70`}>
                        {user.role}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-8">
            {selectedUser ? (
              <div className="bg-white rounded-[4rem] shadow-2xl border border-slate-100 p-16 space-y-12 animate-in zoom-in duration-500">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    <div className="p-5 bg-blue-600 text-white rounded-[2rem] shadow-xl shadow-blue-500/30">
                      <Calculator size={32} />
                    </div>
                    <div>
                      <h4 className="text-3xl font-black text-slate-800 italic uppercase tracking-tighter">Detail Gaji Karyawan</h4>
                      <p className="text-sm font-bold text-slate-400 mt-1">Mengolah slip untuk <span className="text-slate-800">{selectedUser.name}</span></p>
                    </div>
                  </div>
                  <button onClick={() => setSelectedUser(null)} className="p-4 bg-slate-100 text-slate-400 rounded-2xl hover:bg-rose-500 hover:text-white transition shadow-sm">
                    <X size={20} />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                  <div className="space-y-8">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                      <h5 className="text-xs font-black text-slate-800 uppercase tracking-[0.2em] italic">I. Rincian Pendapatan</h5>
                      <CreditCard size={18} className="text-emerald-500" />
                    </div>
                    <div className="space-y-6">
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-400 ml-2 tracking-widest uppercase">GAJI POKOK (Rp)</label>
                        <input type="number" className="w-full p-6 bg-slate-50 border-2 border-transparent focus:border-blue-600 focus:bg-white rounded-[2rem] outline-none font-black text-xl text-slate-800 transition-all shadow-inner" value={form.basicSalary} onChange={e => setForm({ ...form, basicSalary: Number(e.target.value) })} />
                      </div>
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-400 ml-2 tracking-widest uppercase">INSENTIF KEHADIRAN (Rp)</label>
                        <input type="number" className="w-full p-6 bg-slate-50 border-2 border-transparent focus:border-blue-600 focus:bg-white rounded-[2rem] outline-none font-black text-xl text-slate-800 transition-all shadow-inner" value={form.allowance} onChange={e => setForm({ ...form, allowance: Number(e.target.value) })} />
                      </div>
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-400 ml-2 tracking-widest uppercase">BONUS / THR (Rp)</label>
                        <input type="number" className="w-full p-6 bg-slate-50 border-2 border-transparent focus:border-blue-600 focus:bg-white rounded-[2rem] outline-none font-black text-xl text-slate-800 transition-all shadow-inner" value={form.bonus} onChange={e => setForm({ ...form, bonus: Number(e.target.value) })} />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-8">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                      <h5 className="text-xs font-black text-slate-800 uppercase tracking-[0.2em] italic">II. Absensi & Potongan</h5>
                      <Zap size={18} className="text-rose-500" />
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-400 ml-2 tracking-widest uppercase">HARI HADIR</label>
                        <input type="number" className="w-full p-6 bg-slate-50 border-2 border-transparent focus:border-blue-600 focus:bg-white rounded-[2rem] outline-none font-black text-xl text-slate-800 transition-all shadow-inner" value={form.totalHadir} onChange={e => setForm({ ...form, totalHadir: Number(e.target.value) })} />
                      </div>
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-400 ml-2 tracking-widest uppercase">JML IZIN</label>
                        <input type="number" className="w-full p-6 bg-slate-50 border-2 border-transparent focus:border-blue-600 focus:bg-white rounded-[2rem] outline-none font-black text-xl text-slate-800 transition-all shadow-inner" value={form.totalIzin} onChange={e => setForm({ ...form, totalIzin: Number(e.target.value) })} />
                      </div>
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-slate-400 ml-2 tracking-widest uppercase">GAJI PER HARI (Rp)</label>
                      <input type="number" className="w-full p-6 bg-slate-50 border-2 border-transparent focus:border-blue-600 focus:bg-white rounded-[2rem] outline-none font-black text-xl text-slate-800 transition-all shadow-inner" value={form.dailyRate} onChange={e => setForm({ ...form, dailyRate: Number(e.target.value) })} />
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-rose-500 ml-2 tracking-widest uppercase italic border-b border-rose-100 pb-1">Total Potongan (Rp) *</label>
                      <input type="number" className="w-full p-6 bg-rose-50 border-2 border-transparent focus:border-rose-500 focus:bg-white rounded-[2rem] outline-none font-black text-xl text-rose-600 transition-all shadow-inner" value={form.deductions} onChange={e => setForm({ ...form, deductions: Number(e.target.value) })} />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-500 ml-2 tracking-widest uppercase">Catatan Slip (Optional)</label>
                  <textarea rows={2} className="w-full p-8 bg-slate-50 border-2 border-transparent focus:border-blue-600 focus:bg-white rounded-[2.5rem] outline-none font-bold text-sm transition-all shadow-inner" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Ketik catatan tambahan yang akan muncul di slip..." />
                </div>

                <div className="pt-12 border-t flex flex-col xl:flex-row gap-8 items-center justify-between">
                  <div className="p-10 bg-slate-950 text-white rounded-[3rem] flex items-center gap-10 shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-full h-1 bg-blue-600"></div>
                    <div>
                      <p className="text-[11px] font-black text-blue-400 uppercase tracking-[0.3em] leading-none">Net Payback</p>
                      <p className="text-5xl font-black italic tracking-tighter mt-2">{formatCurrency(netSalary)}</p>
                    </div>
                  </div>
                  <div className="flex gap-4 w-full xl:w-auto">
                    <button onClick={handlePreview} className="flex-1 xl:flex-none px-10 py-6 bg-white border-2 border-slate-100 text-slate-800 rounded-3xl text-[11px] font-black uppercase tracking-widest hover:border-slate-900 transition-all flex items-center justify-center gap-3">
                      <Eye size={20} /> Preview
                    </button>
                    <button
                      onClick={handleSend}
                      disabled={isProcessing}
                      className="flex-1 xl:flex-none px-12 py-6 bg-blue-600 text-white rounded-3xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-900 hover:scale-105 transition-all shadow-2xl shadow-blue-500/30 flex items-center justify-center gap-4 disabled:opacity-50"
                    >
                      {isProcessing ? <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div> : <Send size={20} />}
                      Kirim Slip Gaji
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-[4rem] shadow-xl border border-slate-100 p-24 text-center space-y-8">
                <div className="w-40 h-40 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-200">
                  <UserIcon size={80} />
                </div>
                <h4 className="text-2xl font-black text-slate-800 uppercase italic tracking-tighter">Siap Menghasilkan Slip Gaji</h4>
                <p className="text-base font-bold text-slate-400 mt-4 max-w-sm mx-auto">Pilih karyawan di sebelah kiri untuk mengisi nominal gaji.</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-[4rem] shadow-2xl border border-slate-100 overflow-hidden">
          <div className="p-10 border-b bg-slate-50/50 flex items-center justify-between">
            <h4 className="font-black text-slate-800 text-sm uppercase tracking-widest italic flex items-center gap-3">
              <HistoryIcon className="text-blue-600" /> Arsip Pengiriman Slip
            </h4>
          </div>
          {payrollRecords.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50/30 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] border-b">
                  <tr>
                    <th className="px-12 py-8">Karyawan</th>
                    <th className="px-12 py-8">Bulan</th>
                    <th className="px-12 py-8">Total Gaji</th>
                    <th className="px-12 py-8 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {payrollRecords.slice().reverse().map(rec => {
                    const user = users.find(u => u.id === rec.userId);
                    return (
                      <tr key={rec.id} className="hover:bg-blue-50/20 transition-all group">
                        <td className="px-12 py-8">
                          <div className="flex items-center gap-5">
                            <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center font-black text-sm">{user?.name.charAt(0)}</div>
                            <span className="font-black text-slate-800 text-base">{user?.name}</span>
                          </div>
                        </td>
                        <td className="px-12 py-8">
                          <span className="px-4 py-2 bg-slate-100 rounded-xl text-[11px] font-black uppercase">
                            {new Date(rec.month + '-01').toLocaleString('id-ID', { month: 'long', year: 'numeric' })}
                          </span>
                        </td>
                        <td className="px-12 py-8 font-black text-blue-600 text-lg">{formatCurrency(rec.netSalary)}</td>
                        <td className="px-12 py-8 text-right">
                          <button className="p-4 bg-slate-100 text-slate-400 rounded-2xl hover:bg-slate-900 hover:text-white transition">
                            <Printer size={18} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-32 text-center">
              <FileCheck size={64} className="mx-auto text-slate-100" />
              <p className="text-base font-black text-slate-300 uppercase tracking-widest italic mt-6">Belum Ada Riwayat Slip</p>
            </div>
          )}
        </div>
      )}

      {previewBlob && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-8 bg-slate-950/95 backdrop-blur-3xl animate-in fade-in duration-500">
          <div className="bg-white rounded-[4rem] w-full max-w-6xl h-full flex flex-col shadow-2xl border border-white/20 overflow-hidden">
            <div className="p-10 border-b flex justify-between items-center bg-slate-50/50">
              <div>
                <h3 className="text-2xl font-black text-slate-800 italic uppercase">Konfirmasi Slip Gaji</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase mt-2">Pastikan semua nominal sudah benar sebelum dikirim.</p>
              </div>
              <div className="flex gap-4">
                <button onClick={() => setPreviewBlob(null)} className="px-8 py-4 bg-slate-200 text-slate-600 rounded-2xl text-[10px] font-black uppercase">Batal</button>
                <button onClick={handleSend} disabled={isProcessing} className="px-10 py-4 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase flex items-center gap-3">
                  {isProcessing ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div> : <Send size={16} />}
                  Kirim via Telegram
                </button>
              </div>
            </div>
            <div className="flex-1 bg-slate-900 p-12 overflow-hidden">
              <iframe
                src={URL.createObjectURL(previewBlob)}
                className="w-full h-full rounded-[2.5rem] bg-white border-none"
                title="PDF Preview"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PayrollModule;
