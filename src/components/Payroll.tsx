
import React, { useState } from 'react';
import { User, UserRole, UserSalaryConfig, PayrollRecord, Attendance, AppSettings } from '../types';
import { formatCurrency, sendTelegramDocument } from '../utils';
import { CreditCard, Users, Settings, Send, FileText, CheckCircle2, AlertCircle, Download, Landmark, History as HistoryIcon, Eye, Zap, Trash2 } from 'lucide-react';
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
  currentUser, users, salaryConfigs, attendance, settings, payrollRecords, onUpdateSalary, onAddPayroll, toast
}) => {
  const [activeTab, setActiveTab] = useState<'MANAGEMENT' | 'HISTORY'>('MANAGEMENT');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [editingConfig, setEditingConfig] = useState<UserSalaryConfig | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewData, setPreviewData] = useState<{ user: User, record: PayrollRecord } | null>(null);

  const getAttendanceStats = (userId: string, month: string) => {
    const filtered = attendance.filter(a => {
      const d = new Date(a.date);
      const mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      return a.userId === userId && mStr === month;
    });

    return {
      totalHadir: filtered.length,
      totalTelat: filtered.filter(a => a.isLate).length
    };
  };

  const calculateRecord = (user: User, month: string): PayrollRecord | null => {
    const config = salaryConfigs.find(c => c.userId === user.id);
    if (!config) return null;

    const stats = getAttendanceStats(user.id, month);
    const totalMeal = stats.totalHadir * config.mealAllowance;
    const lateDeduction = stats.totalTelat * config.lateDeduction;
    const net = config.basicSalary + config.allowance + totalMeal - lateDeduction;

    return {
      id: Math.random().toString(36).substr(2, 9),
      userId: user.id,
      month: month,
      basicSalary: config.basicSalary,
      allowance: config.allowance,
      totalMealAllowance: totalMeal,
      bonus: 0,
      deductions: lateDeduction,
      netSalary: net,
      isSent: false,
      processedAt: Date.now(),
      metadata: {
        totalHadir: stats.totalHadir,
        totalTelat: stats.totalTelat
      }
    };
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
    const p = settings.companyProfile;
    const logoPos = p.logoPosition || 'top';
    const textAlgn = p.textAlignment || 'center';

    let currentY = 20;
    const pageWidth = 210;
    const margin = 20;

    // Header Logic
    if (logoPos === 'top') {
      if (p.logoUrl) {
        const logoW = 25, logoH = 25;
        let logoX = (pageWidth / 2) - (logoW / 2);
        if (textAlgn === 'left') logoX = margin;
        if (textAlgn === 'right') logoX = pageWidth - margin - logoW;
        try { doc.addImage(p.logoUrl, 'PNG', logoX, currentY, logoW, logoH); } catch(e){}
        currentY += logoH + 8;
      }
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.text(p.name.toUpperCase(), textAlgn === 'center' ? 105 : (textAlgn === 'left' ? margin : pageWidth - margin), currentY, { align: textAlgn });
      currentY += 8;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(p.address, textAlgn === 'center' ? 105 : (textAlgn === 'left' ? margin : pageWidth - margin), currentY, { align: textAlgn });
      currentY += 5;
      doc.text(`Telp: ${p.phone}`, textAlgn === 'center' ? 105 : (textAlgn === 'left' ? margin : pageWidth - margin), currentY, { align: textAlgn });
      currentY += 10;
    } else if (logoPos === 'left') {
      const logoW = 30, logoH = 30;
      if (p.logoUrl) try { doc.addImage(p.logoUrl, 'PNG', margin, currentY, logoW, logoH); } catch(e){}
      const textX = margin + (p.logoUrl ? logoW + 10 : 0);
      doc.setFontSize(18); doc.setFont('helvetica', 'bold');
      doc.text(p.name.toUpperCase(), textX, currentY + 10);
      doc.setFontSize(9); doc.setFont('helvetica', 'normal');
      doc.text(p.address, textX, currentY + 16, { maxWidth: pageWidth - textX - margin });
      doc.text(`Telp: ${p.phone}`, textX, currentY + 24);
      currentY += Math.max(logoH, 30) + 10;
    } else if (logoPos === 'right') {
      const logoW = 30, logoH = 30;
      if (p.logoUrl) try { doc.addImage(p.logoUrl, 'PNG', pageWidth - margin - logoW, currentY, logoW, logoH); } catch(e){}
      const textXEnd = pageWidth - margin - (p.logoUrl ? logoW + 10 : 0);
      doc.setFontSize(18); doc.setFont('helvetica', 'bold');
      doc.text(p.name.toUpperCase(), textXEnd, currentY + 10, { align: 'right' });
      doc.setFontSize(9); doc.setFont('helvetica', 'normal');
      doc.text(p.address, textXEnd, currentY + 16, { align: 'right', maxWidth: textXEnd - margin });
      doc.text(`Telp: ${p.phone}`, textXEnd, currentY + 24, { align: 'right' });
      currentY += Math.max(logoH, 30) + 10;
    }

    doc.setDrawColor(30, 41, 59); doc.setLineWidth(0.8);
    doc.line(margin, currentY, pageWidth - margin, currentY);
    currentY += 15;

    // Slip Content
    doc.setFontSize(16); doc.setFont('helvetica', 'bold');
    doc.text('SLIP GAJI KARYAWAN', 105, currentY, { align: 'center' });
    currentY += 8;
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text(`Periode: ${record.month}`, 105, currentY, { align: 'center' });
    currentY += 20;

    doc.text(`Nama: ${user.name}`, margin, currentY);
    doc.text(`Jabatan: ${user.role}`, margin, currentY + 7);
    currentY += 25;

    doc.setFillColor(248, 250, 252);
    doc.rect(margin, currentY, 170, 10, 'F');
    doc.setFont('helvetica', 'bold');
    doc.text('KOMPONEN PENERIMAAN', margin + 5, currentY + 7);
    doc.text('NOMINAL', 150, currentY + 7);
    currentY += 15;

    const row = (l: string, v: number) => {
      doc.setFont('helvetica', 'normal');
      doc.text(l, margin + 5, currentY);
      doc.text(formatCurrency(v), 150, currentY);
      currentY += 8;
    };

    row('Gaji Pokok', record.basicSalary);
    row('Tunjangan Jabatan', record.allowance);
    row(`Uang Makan (${record.metadata?.totalHadir || 0} hari)`, record.totalMealAllowance);
    row('Bonus', record.bonus);

    currentY += 5;
    doc.setFillColor(248, 250, 252);
    doc.rect(margin, currentY, 170, 10, 'F');
    doc.setFont('helvetica', 'bold');
    doc.text('POTONGAN', margin + 5, currentY + 7);
    currentY += 15;
    row(`Potongan Telat (${record.metadata?.totalTelat || 0} event)`, record.deductions);

    currentY += 10;
    doc.setLineWidth(0.5); doc.line(margin, currentY, pageWidth - margin, currentY);
    currentY += 12;
    doc.setFontSize(12); doc.text('TOTAL DITERIMA (THP)', margin + 5, currentY);
    doc.text(formatCurrency(record.netSalary), 150, currentY);

    currentY += 40;
    doc.setFontSize(10); doc.text('Penerima,', 40, currentY, { align: 'center' });
    doc.text('Admin SDM,', 160, currentY, { align: 'center' });
    currentY += 25;
    doc.text(`( ${user.name} )`, 40, currentY, { align: 'center' });
    doc.text(`( Finance Team )`, 160, currentY, { align: 'center' });

    return doc.output('blob');
  };

  const handleSendSingle = async (user: User, record: PayrollRecord) => {
    setIsProcessing(true);
    try {
      if (user.telegramId && settings.telegramBotToken) {
        const pdfBlob = await generatePDF(user, record);
        await sendTelegramDocument(settings.telegramBotToken, user.telegramId, pdfBlob, `Slip_${user.username}_${record.month}.pdf`, `Slip Gaji ${record.month} telah dikirim.`);
        onAddPayroll({ ...record, isSent: true });
        toast.success(`Slip gaji ${record.month} untuk ${user.name} berhasil dikirim via Telegram!`);
      } else {
        toast.warning("ID Telegram karyawan atau Token Bot belum diset. Pastikan:\n- Tab Settings sudah diisi BOT API TOKEN\n- User memiliki Telegram ID numerik.");
      }
    } catch (e: any) {
      console.error('Gagal kirim slip via Telegram:', e);
      const errorMsg = e?.message || 'Terjadi kesalahan saat mengirim slip via Telegram.';
      if (errorMsg.includes('chat not found')) {
        toast.error('Chat tidak ditemukan. Pastikan Telegram ID benar dan user sudah memulai chat dengan bot.');
      } else if (errorMsg.includes('Unauthorized')) {
        toast.error('Token bot tidak valid. Periksa BOT API TOKEN di Settings.');
      } else {
        toast.error(errorMsg + ' Periksa kembali token bot, Telegram ID, dan koneksi internet Anda.');
      }
    } finally {
      setIsProcessing(false);
      setPreviewData(null);
    }
  };

  const handleBulkSend = async () => {
    const confirming = window.confirm(`Kirim slip gaji masal ke semua karyawan periode ${selectedMonth}?`);
    if (!confirming) return;
    setIsProcessing(true);
    let sentCount = 0;
    let failedCount = 0;
    for (const user of users.filter(u => u.role !== UserRole.OWNER)) {
      const record = calculateRecord(user, selectedMonth);
      if (!record) continue;

      if (!user.telegramId || !settings.telegramBotToken) {
        console.warn(`Lewati ${user.username}: Telegram ID atau BOT TOKEN belum di-set.`);
        failedCount++;
        continue;
      }

      try {
        const pdfBlob = await generatePDF(user, record);
        await sendTelegramDocument(settings.telegramBotToken, user.telegramId, pdfBlob, `Slip_${user.username}_${selectedMonth}.pdf`, `Slip Gaji Masal ${selectedMonth}.`);
        onAddPayroll({ ...record, isSent: true });
        sentCount++;
      } catch (e) {
        console.error(`Gagal kirim slip untuk ${user.username}:`, e);
        failedCount++;
      }
    }
    setIsProcessing(false);
    if (sentCount > 0) {
      toast.success(`${sentCount} slip berhasil dikirim.${failedCount > 0 ? ` ${failedCount} gagal (periksa Telegram ID dan token bot).` : ''}`);
    } else {
      toast.error(`Tidak ada slip yang berhasil dikirim. Periksa konfigurasi Telegram di Settings.`);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h3 className="text-4xl font-black text-slate-800 tracking-tighter italic leading-none">Payroll Center</h3>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mt-3">Sukses Digital Media Slip Engine</p>
        </div>
        <div className="flex items-center space-x-3">
          <input type="month" className="p-4 bg-white border-2 border-slate-100 rounded-[1.5rem] font-black text-xs outline-none focus:border-blue-600 shadow-sm" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} />
          <button onClick={handleBulkSend} disabled={isProcessing} className="bg-emerald-600 text-white px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center shadow-xl hover:bg-emerald-700 transition disabled:opacity-50">
            <Zap size={16} className="mr-2" /> KIRIM MASAL
          </button>
          <button onClick={() => setActiveTab(activeTab === 'MANAGEMENT' ? 'HISTORY' : 'MANAGEMENT')} className="bg-slate-900 text-white px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center shadow-xl hover:bg-blue-600 transition">
            {activeTab === 'MANAGEMENT' ? <HistoryIcon className="mr-2" size={16} /> : <Users className="mr-2" size={16} />}
            {activeTab === 'MANAGEMENT' ? 'RIWAYAT' : 'KELOLA'}
          </button>
        </div>
      </div>

      {activeTab === 'MANAGEMENT' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="bg-white rounded-[3.5rem] lg:col-span-2 shadow-xl border border-slate-100 overflow-hidden flex flex-col h-full">
              <div className="p-10 border-b bg-slate-50/50 flex justify-between items-center">
                <h4 className="font-black text-slate-800 text-lg uppercase tracking-tight italic">Employee Payroll Management</h4>
              </div>
              <div className="overflow-x-auto flex-1 custom-scrollbar">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Karyawan</th>
                      <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Jabatan</th>
                      <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">THP Estimasi</th>
                      <th className="px-8 py-5 text-right text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {users.filter(u => u.role !== UserRole.OWNER).map(user => {
                      const record = calculateRecord(user, selectedMonth);
                      return (
                        <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-8 py-5">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center font-black text-sm shadow-sm">
                                {user.name.charAt(0)}
                              </div>
                              <span className="font-bold text-slate-800 text-sm">{user.name}</span>
                            </div>
                          </td>
                          <td className="px-8 py-5">
                            <span className="px-3 py-1 bg-slate-100 text-slate-500 rounded-lg text-[10px] font-black uppercase tracking-widest">{user.role}</span>
                          </td>
                          <td className="px-8 py-5">
                            <span className="font-black text-slate-800 text-sm">{record ? formatCurrency(record.netSalary) : 'N/A'}</span>
                          </td>
                          <td className="px-8 py-5 text-right flex justify-end gap-2">
                            <button onClick={() => setEditingConfig(salaryConfigs.find(c => c.userId === user.id) || { userId: user.id, basicSalary: 0, allowance: 0, mealAllowance: 0, lateDeduction: 0 })} className="p-3 bg-slate-100 text-slate-400 rounded-xl hover:bg-blue-600 hover:text-white transition" title="Config Salary">
                              <Settings size={16} />
                            </button>
                            <button onClick={() => record && setPreviewData({ user, record })} className="p-3 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-600 hover:text-white transition shadow-sm" title="Preview Slip">
                              <Eye size={16} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          <div className="bg-slate-900 text-white p-10 rounded-[3.5rem] shadow-2xl relative overflow-hidden">
             <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/20 blur-3xl rounded-full -mr-16 -mt-16"></div>
             <Landmark className="text-blue-400 mb-8" size={32} />
             <h4 className="text-2xl font-black italic uppercase tracking-tight mb-8">Summary {selectedMonth}</h4>
             <div className="space-y-4 pt-8 border-t border-white/5">
                <div className="flex justify-between items-center">
                   <span className="text-[10px] font-black text-slate-500 uppercase">TOTAL KARYAWAN</span>
                   <span className="text-lg font-black">{users.length - 1} Orang</span>
                </div>
                <div className="flex justify-between items-center bg-blue-600 p-6 rounded-[2rem] shadow-xl">
                   <span className="text-[10px] font-black text-white uppercase">TOTAL PAYOUT</span>
                   <span className="text-xl font-black text-white">{formatCurrency(users.filter(u => u.role !== UserRole.OWNER).reduce((acc, u) => acc + (calculateRecord(u, selectedMonth)?.netSalary || 0), 0))}</span>
                </div>
             </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-[3.5rem] shadow-xl border border-slate-100 overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 text-slate-400 text-[9px] font-black uppercase tracking-[0.2em] border-b">
                <th className="px-10 py-6">KARYAWAN</th>
                <th className="px-10 py-6">BULAN</th>
                <th className="px-10 py-6">NOMINAL</th>
                <th className="px-10 py-6 text-right">AKSI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {payrollRecords.slice().reverse().map(rec => {
                const user = users.find(u => u.id === rec.userId);
                return (
                  <tr key={rec.id} className="hover:bg-blue-50/20 transition-colors">
                    <td className="px-10 py-6 flex items-center space-x-3">
                       <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-black text-[10px]">{user?.name.charAt(0)}</div>
                       <span className="text-xs font-black text-slate-800">{user?.name}</span>
                    </td>
                    <td className="px-10 py-6 text-[10px] font-black uppercase text-slate-400">{rec.month}</td>
                    <td className="px-10 py-6 text-sm font-black text-blue-600">{formatCurrency(rec.netSalary)}</td>
                    <td className="px-10 py-6 text-right">
                       <button onClick={() => user && setPreviewData({ user, record: rec })} className="p-3 bg-slate-100 text-slate-400 rounded-xl hover:bg-blue-600 hover:text-white transition">
                          <Eye size={16} />
                       </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Preview Slip Modal */}
      {previewData && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/95 backdrop-blur-xl p-4 overflow-y-auto">
          <div className="bg-white rounded-[3.5rem] w-full max-w-2xl my-8 shadow-2xl border border-white/20 animate-in zoom-in duration-300">
            <div className="p-10 border-b flex justify-between items-center bg-slate-50/50">
              <div>
                <h3 className="text-2xl font-black text-slate-800 italic uppercase tracking-tighter leading-none">Slip Preview</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">{previewData.user.name} • {previewData.record.month}</p>
              </div>
              <button onClick={() => setPreviewData(null)} className="p-4 bg-slate-200 rounded-2xl hover:bg-rose-500 hover:text-white transition">✕</button>
            </div>
            <div className="p-10 space-y-8">
              <div className="bg-white border-2 border-slate-100 rounded-[2rem] p-8 shadow-inner relative overflow-hidden flex flex-col">
                <div className="absolute top-0 left-0 right-0 h-1 bg-blue-600"></div>
                <div className={`flex w-full items-center gap-4 mb-8 ${
                  settings.companyProfile.logoPosition === 'top' ? 'flex-col' : 
                  settings.companyProfile.logoPosition === 'right' ? 'flex-row-reverse' : 'flex-row'
                }`}>
                  {settings.companyProfile.logoUrl && (
                    <img src={settings.companyProfile.logoUrl} className="h-14 w-auto object-contain" alt="Logo" />
                  )}
                  <div className={`flex-1 ${
                    settings.companyProfile.textAlignment === 'left' ? 'text-left' :
                    settings.companyProfile.textAlignment === 'right' ? 'text-right' : 'text-center'
                  }`}>
                    <h4 className="text-base font-black text-slate-800 uppercase leading-none mb-1">{settings.companyProfile.name}</h4>
                    <p className="text-[8px] font-bold text-slate-400 leading-tight">{settings.companyProfile.address}</p>
                    <p className="text-[8px] font-black text-blue-600 mt-1">{settings.companyProfile.phone}</p>
                  </div>
                </div>
                <div className="h-[1px] bg-slate-200 mb-6"></div>
                <div className="text-center mb-6">
                  <h5 className="text-xs font-black text-slate-800 uppercase tracking-widest">SLIP GAJI KARYAWAN</h5>
                  <p className="text-[9px] font-bold text-slate-400">{previewData.record.month}</p>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-6">
                   <div className="p-4 bg-slate-50 rounded-xl">
                      <p className="text-[8px] font-black text-slate-400 uppercase mb-1">KARYAWAN</p>
                      <p className="text-[10px] font-black text-slate-800">{previewData.user.name}</p>
                      <p className="text-[9px] font-bold text-slate-500">{previewData.user.role}</p>
                   </div>
                   <div className="p-4 bg-slate-50 rounded-xl">
                      <p className="text-[8px] font-black text-slate-400 uppercase mb-1">TELEGRAM ID</p>
                      <p className="text-[10px] font-black text-blue-600">{previewData.user.telegramUsername}</p>
                   </div>
                </div>
                <div className="space-y-2 mb-8">
                   <div className="flex justify-between items-center text-[9px] font-black text-slate-400 border-b pb-1"><span>ITEM</span><span>NOMINAL</span></div>
                   <div className="flex justify-between text-xs font-bold text-slate-600"><span>Gaji Pokok</span><span>{formatCurrency(previewData.record.basicSalary)}</span></div>
                   <div className="flex justify-between text-xs font-bold text-slate-600"><span>Tunjangan</span><span>{formatCurrency(previewData.record.allowance)}</span></div>
                   <div className="flex justify-between text-xs font-bold text-slate-600"><span>Uang Makan</span><span>{formatCurrency(previewData.record.totalMealAllowance)}</span></div>
                   <div className="flex justify-between text-xs font-bold text-rose-500"><span>Potongan Telat</span><span>-{formatCurrency(previewData.record.deductions)}</span></div>
                </div>
                <div className="flex justify-between items-center p-4 bg-slate-900 text-white rounded-xl">
                  <span className="text-[10px] font-black uppercase">TOTAL TAKE HOME PAY</span>
                  <span className="text-base font-black">{formatCurrency(previewData.record.netSalary)}</span>
                </div>
              </div>
              <button onClick={() => handleSendSingle(previewData.user, previewData.record)} disabled={isProcessing} className="w-full bg-slate-900 text-white py-5 rounded-[2rem] font-black text-xs uppercase tracking-widest shadow-2xl hover:bg-blue-600 transition flex items-center justify-center gap-3">
                 <Send size={18} /> {previewData.record.isSent ? "KIRIM ULANG SLIP" : "KIRIM SLIP VIA TELEGRAM"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Editing Salary Config Modal */}
      {editingConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/90 backdrop-blur-md p-4">
          <div className="bg-white rounded-[3.5rem] w-full max-w-lg p-12 shadow-2xl border border-white/20 animate-in zoom-in duration-300">
            <h3 className="text-2xl font-black text-slate-800 mb-8 italic uppercase">Salary Configuration</h3>
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">GAJI POKOK (IDR)</label>
                  <input type="number" className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-blue-600 rounded-2xl outline-none font-black text-sm" value={editingConfig.basicSalary} onChange={e => setEditingConfig({...editingConfig, basicSalary: Number(e.target.value)})} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">TUNJANGAN JABATAN</label>
                  <input type="number" className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-blue-600 rounded-2xl outline-none font-black text-sm" value={editingConfig.allowance} onChange={e => setEditingConfig({...editingConfig, allowance: Number(e.target.value)})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">MAKAN (PER HARI)</label>
                  <input type="number" className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-blue-600 rounded-2xl outline-none font-black text-sm" value={editingConfig.mealAllowance} onChange={e => setEditingConfig({...editingConfig, mealAllowance: Number(e.target.value)})} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">POTONGAN TELAT</label>
                  <input type="number" className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-blue-600 rounded-2xl outline-none font-black text-sm" value={editingConfig.lateDeduction} onChange={e => setEditingConfig({...editingConfig, lateDeduction: Number(e.target.value)})} />
                </div>
              </div>
            </div>
            <div className="flex gap-4 mt-10">
              <button onClick={() => setEditingConfig(null)} className="flex-1 py-4 text-slate-400 font-black uppercase tracking-widest hover:bg-slate-100 rounded-2xl transition text-[10px]">BATAL</button>
              <button onClick={() => { onUpdateSalary(editingConfig); setEditingConfig(null); }} className="flex-1 bg-slate-900 text-white py-4 rounded-[1.5rem] font-black uppercase tracking-widest hover:bg-blue-600 transition text-[10px] shadow-xl">SIMPAN CONFIG</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PayrollModule;
