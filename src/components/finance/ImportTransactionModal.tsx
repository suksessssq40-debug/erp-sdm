import React, { useState } from 'react';
import { Upload, X, FileSpreadsheet, AlertCircle, CheckCircle, Download } from 'lucide-react';
import { useToast } from '../Toast';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  toast: ReturnType<typeof useToast>;
}

export const ImportTransactionModal: React.FC<ImportModalProps> = ({ isOpen, onClose, onSuccess, toast }) => {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [report, setReport] = useState<{ processed: number, errors: string[], batchId?: string } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setReport(null);
    }
  };

  const handleUndo = async () => {
    if (!report?.batchId) return;
    if (!confirm("Apakah Anda yakin ingin membatalkan import terakhir ini? Saldo akan dikembalikan otomatis.")) return;

    setIsProcessing(true);
    try {
        const token = localStorage.getItem('sdm_erp_auth_token') || '';
        const res = await fetch('/api/finance/import/undo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ batchId: report.batchId })
        });
        const data = await res.json();
        if (res.ok) {
            toast.success(data.message);
            setReport(null);
            setFile(null);
            onSuccess();
        } else {
            toast.error(data.error);
        }
    } catch (e) {
        toast.error("Gagal melakukan Undo");
    } finally {
        setIsProcessing(false);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsProcessing(true);
    setReport(null); 

    const formData = new FormData();
    formData.append('file', file);

    const token = typeof window !== 'undefined' ? localStorage.getItem('sdm_erp_auth_token') : '';

    if (!token) {
        toast.error("Sesi habis. Silakan login ulang.");
        setIsProcessing(false);
        return;
    }

    try {
      const res = await fetch('/api/finance/import', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`
        },
        body: formData,
      });
      const data = await res.json();

      if (res.ok) {
        setReport({ processed: data.processed, errors: data.errors || [], batchId: data.batchId });
        if (data.processed > 0) {
            toast.success(`Berhasil mengimport ${data.processed} transaksi!`);
            onSuccess();
        } else {
            toast.warning("File diproses tapi tidak ada transaksi baru.");
        }
      } else {
        toast.error(data.error || 'Gagal import');
        setReport(null);
      }
    } catch (err) {
      toast.error('Terjadi kesalahan koneksi');
      setReport(null);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-white rounded-[2rem] w-full max-w-2xl p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar">
        <button onClick={onClose} className="absolute top-6 right-6 p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition">
          <X size={20} className="text-slate-500" />
        </button>

        <div className="mb-6">
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center">
                    <FileSpreadsheet size={24} />
                </div>
                <div>
                    <h3 className="text-xl font-bold text-slate-800">
                    Import Transaksi Excel
                    </h3>
                    <div className="mt-1 flex gap-2">
                        <a href="/api/finance/import/template" className="text-[10px] bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg border border-blue-200 font-bold hover:bg-blue-100 transition flex items-center gap-1">
                            <Download size={12}/> DOWNLOAD TEMPLATE
                        </a>
                    </div>
                </div>
            </div>
        </div>

        {/* GUIDANCE SECTION */}
        {!report && (
             <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-xs text-slate-600 mb-6 space-y-2">
                <p className="font-bold text-slate-800 border-b border-slate-200 pb-1 mb-2">PANDUAN PENGISIAN:</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-2 bg-white rounded-lg border border-slate-100 shadow-sm">
                        <p className="font-black text-emerald-600 flex items-center gap-1 mb-1">💰 UANG MASUK (IN)</p>
                        <ul className="list-disc pl-4 space-y-0.5 text-[10px]">
                            <li>Kolom <b>AKUN DEBET</b> = Nama Bank (Misal: <i>Bank BCA</i>)</li>
                            <li>Kolom <b>AKUN KREDIT</b> = Akun Lawan (Misal: <i>Penjualan</i>)</li>
                        </ul>
                    </div>
                    <div className="p-2 bg-white rounded-lg border border-slate-100 shadow-sm">
                        <p className="font-black text-rose-600 flex items-center gap-1 mb-1">💸 UANG KELUAR (OUT)</p>
                        <ul className="list-disc pl-4 space-y-0.5 text-[10px]">
                            <li>Kolom <b>AKUN KREDIT</b> = Nama Bank (Misal: <i>Bank BCA</i>)</li>
                            <li>Kolom <b>AKUN DEBET</b> = Akun Lawan (Misal: <i>Beban Listrik</i>)</li>
                        </ul>
                    </div>
                </div>
            </div>
        )}

        {/* UPLOAD & RESULT */}
        {!report ? (
            <div className="space-y-6">
                 <label className="w-full h-32 border-4 border-dashed border-slate-100 rounded-3xl flex flex-col items-center justify-center cursor-pointer hover:border-emerald-200 hover:bg-emerald-50 transition group">
                    <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleFileChange} />
                    {file ? (
                        <div className="text-center">
                            <FileSpreadsheet className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                            <span className="text-sm font-bold text-slate-700">{file.name}</span>
                            <p className="text-[10px] text-slate-400 mt-1">{(file.size / 1024).toFixed(1)} KB</p>
                        </div>
                    ) : (
                        <div className="text-center">
                            <Upload className="w-8 h-8 text-slate-300 group-hover:text-emerald-500 mx-auto mb-2 transition" />
                            <span className="text-xs font-bold text-slate-400 group-hover:text-emerald-600">Klik untuk Pilih File Excel</span>
                        </div>
                    )}
                 </label>

                 <button 
                 onClick={handleUpload}
                 disabled={!file || isProcessing}
                 className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-emerald-200"
                 >
                     {isProcessing ? 'SEDANG MEMPROSES...' : 'PROSES DATA IMPORT'}
                 </button>
            </div>
        ) : (
            <div className="space-y-6 animate-in zoom-in">
                <div className="bg-slate-50 rounded-2xl p-6 text-center border border-slate-100">
                    <p className="text-lg font-black text-slate-700 mb-1">Hasil Import</p>
                    <div className="flex justify-center gap-4 mt-4">
                         <div className="bg-white px-4 py-3 rounded-xl shadow-sm border border-slate-200">
                             <span className="block text-2xl font-black text-emerald-500">{report.processed}</span>
                             <span className="text-[10px] font-bold text-slate-400 uppercase">Sukses</span>
                         </div>
                         <div className="bg-white px-4 py-3 rounded-xl shadow-sm border border-slate-200">
                             <span className="block text-2xl font-black text-rose-500">{report.errors.length}</span>
                             <span className="text-[10px] font-bold text-slate-400 uppercase">Gagal/Skip</span>
                         </div>
                    </div>
                </div>

                {report.errors.length > 0 && (
                    <div className="max-h-40 overflow-y-auto bg-rose-50 rounded-xl p-4 border border-rose-100 custom-scrollbar">
                        <p className="text-[10px] font-bold text-rose-700 mb-2 flex items-center gap-2"><AlertCircle size={12}/> Detail:</p>
                        <ul className="space-y-1">
                            {report.errors.map((err, idx) => (
                                <li key={idx} className="text-[10px] text-rose-600 font-medium font-mono">• {err}</li>
                            ))}
                        </ul>
                    </div>
                )}
                
                <div className="grid grid-cols-2 gap-4">
                    <button 
                        onClick={handleUndo} 
                        disabled={isProcessing || report.processed === 0}
                        className="py-4 bg-rose-100 text-rose-600 rounded-2xl font-bold uppercase text-[10px] tracking-widest hover:bg-rose-200 transition disabled:opacity-30 flex items-center justify-center gap-2"
                    >
                        {isProcessing ? '...' : <><AlertCircle size={14}/> Batalkan (Undo)</>}
                    </button>
                    <button onClick={() => { setReport(null); setFile(null); onClose(); onSuccess(); }} className="py-4 bg-slate-900 text-white rounded-2xl font-bold uppercase text-[10px] tracking-widest hover:bg-slate-700 transition">
                        Selesai
                    </button>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};
