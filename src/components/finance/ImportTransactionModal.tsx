import React, { useState } from 'react';
import { Upload, X, FileSpreadsheet, AlertCircle, FileText, Download } from 'lucide-react';
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
        if (!confirm("Apakah Anda yakin ingin membatalkan import terakhir ini? Saldo akun akan dikembalikan otomatis ke posisi semula.")) return;

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
            toast.error("Gagal membatalkan import.");
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
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData,
            });
            const data = await res.json();

            if (res.ok) {
                setReport({ processed: data.processed, errors: data.errors || [], batchId: data.batchId });
                if (data.processed > 0) {
                    toast.success(`Berhasil mengimport ${data.processed} jurnal!`);
                    onSuccess();
                } else {
                    toast.warning("File diproses tapi tidak ada data baru.");
                }
            } else {
                toast.error(data.error || 'Gagal import');
                setReport(null);
            }
        } catch (err) {
            toast.error('Gagal menghubungi server');
            setReport(null);
        } finally {
            setIsProcessing(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/90 backdrop-blur-md p-4 animate-in fade-in duration-300">
            <div className="bg-white rounded-[3.5rem] w-full max-w-2xl p-10 shadow-2xl border border-white/20 animate-in zoom-in duration-500 overflow-y-auto max-h-[90vh] custom-scrollbar">

                <div className="flex justify-between items-center mb-10">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-blue-600 text-white rounded-[1.5rem] flex items-center justify-center shadow-lg shadow-blue-100 italic font-black text-2xl">Ex</div>
                        <div>
                            <h3 className="text-2xl font-black text-slate-800 italic uppercase tracking-tighter">Import Jurnal</h3>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Universal Transaction Importer (Excel)</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-12 h-12 bg-slate-100 rounded-2xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition flex items-center justify-center font-bold">✕</button>
                </div>

                {!report && (
                    <>
                        <div className="bg-blue-50/50 p-6 rounded-[2.5rem] border border-blue-100 mb-8">
                            <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                                <FileText size={14} /> PANDUAN DEBET & KREDIT (LOGIKA EXCEL):
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-white p-4 rounded-2xl border border-blue-50">
                                    <p className="text-[9px] font-black text-emerald-600 mb-2 uppercase italic">• UANG MASUK (IN)</p>
                                    <p className="text-[10px] text-slate-500 leading-relaxed font-medium">
                                        Kolom <b>DEBET</b> = Nama Bank (BCA)<br />
                                        Kolom <b>KREDIT</b> = Akun Pendapatan
                                    </p>
                                </div>
                                <div className="bg-white p-4 rounded-2xl border border-blue-50">
                                    <p className="text-[9px] font-black text-rose-600 mb-2 uppercase italic">• UANG KELUAR (OUT)</p>
                                    <p className="text-[10px] text-slate-500 leading-relaxed font-medium">
                                        Kolom <b>DEBET</b> = Akun Biaya/Beban<br />
                                        Kolom <b>KREDIT</b> = Nama Bank (BCA)
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={async () => {
                                    try {
                                        const token = localStorage.getItem('sdm_erp_auth_token') || '';
                                        const res = await fetch('/api/finance/import/template', { headers: { 'Authorization': `Bearer ${token}` } });
                                        if (!res.ok) throw new Error();
                                        const blob = await res.blob();
                                        const url = window.URL.createObjectURL(blob);
                                        const a = document.createElement('a');
                                        a.href = url;
                                        a.download = 'Template_Jurnal_SDM_ERP.xlsx';
                                        a.click();
                                    } catch (e) { toast.error("Gagal download template"); }
                                }}
                                className="w-full mt-4 py-3.5 bg-white border border-blue-100 text-blue-600 rounded-2xl text-[9px] font-black uppercase tracking-widest hover:bg-blue-600 hover:text-white transition flex items-center justify-center gap-2 group"
                            >
                                <Download size={14} className="group-hover:-translate-y-1 transition-transform" /> DOWNLOAD TEMPLATE EXCEL TERBARU
                            </button>
                        </div>

                        <div className="space-y-6">
                            <label className="w-full h-40 border-4 border-dashed border-slate-100 rounded-[3rem] flex flex-col items-center justify-center cursor-pointer hover:border-blue-200 hover:bg-blue-50/30 transition-all group">
                                <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleFileChange} />
                                {file ? (
                                    <div className="text-center animate-in zoom-in">
                                        <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
                                            <FileSpreadsheet size={24} />
                                        </div>
                                        <span className="text-sm font-black text-slate-700 block max-w-[200px] truncate mx-auto">{file.name}</span>
                                        <p className="text-[9px] font-black text-slate-400 mt-1 uppercase tracking-widest">{(file.size / 1024).toFixed(1)} KB READY</p>
                                    </div>
                                ) : (
                                    <div className="text-center group-hover:scale-105 transition-transform">
                                        <Upload className="w-10 h-10 text-slate-200 group-hover:text-blue-500 mx-auto mb-3 transition-colors" />
                                        <span className="text-[10px] font-black text-slate-400 group-hover:text-blue-600 uppercase tracking-widest">Klik atau Taruh File Excel Disini</span>
                                    </div>
                                )}
                            </label>

                            <button
                                onClick={handleUpload}
                                disabled={!file || isProcessing}
                                className="w-full py-5 bg-slate-900 text-white rounded-[2rem] font-black uppercase text-[11px] tracking-[0.3em] hover:bg-blue-600 transition disabled:opacity-30 shadow-2xl shadow-blue-900/10 flex items-center justify-center gap-3"
                            >
                                {isProcessing ? 'SEDANG MEMPROSES...' : 'MULAI IMPORT JURNAL'}
                            </button>
                        </div>
                    </>
                )}

                {report && (
                    <div className="space-y-8 animate-in zoom-in duration-500">
                        <div className="bg-slate-50 rounded-[2.5rem] p-10 text-center border border-slate-100 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-6 opacity-5"><FileSpreadsheet size={80} /></div>
                            <h4 className="text-xl font-black text-slate-800 uppercase italic mb-8">Hasil Import Jurnal</h4>
                            <div className="flex justify-center gap-6">
                                <div className="bg-white px-8 py-6 rounded-[2rem] shadow-xl border border-emerald-50 relative group">
                                    <span className="block text-4xl font-black text-emerald-500 tabular-nums">{report.processed}</span>
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Berhasil</span>
                                </div>
                                <div className="bg-white px-8 py-6 rounded-[2rem] shadow-xl border border-rose-50">
                                    <span className="block text-4xl font-black text-rose-500 tabular-nums">{report.errors.length}</span>
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Gagal/Skip</span>
                                </div>
                            </div>
                        </div>

                        {report.errors.length > 0 && (
                            <div className="max-h-56 overflow-y-auto bg-rose-50/50 rounded-[2rem] p-8 border border-rose-100 custom-scrollbar">
                                <p className="text-[10px] font-black text-rose-700 mb-4 flex items-center gap-2 uppercase tracking-widest"><AlertCircle size={14} /> Problem Log:</p>
                                <ul className="space-y-2">
                                    {report.errors.map((err, idx) => (
                                        <li key={idx} className="text-[10px] text-rose-600 font-bold leading-relaxed flex gap-3">
                                            <span className="flex-shrink-0 w-5 h-5 bg-white rounded-lg flex items-center justify-center text-[8px] border border-rose-100 shadow-sm">{idx + 1}</span>
                                            {err}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-6 pb-4">
                            <button
                                onClick={handleUndo}
                                disabled={isProcessing || report.processed === 0}
                                className="py-5 bg-rose-50 text-rose-600 rounded-[2rem] font-black uppercase text-[10px] tracking-[0.2em] hover:bg-rose-100 transition disabled:opacity-30 flex items-center justify-center gap-3 border border-rose-100"
                            >
                                {isProcessing ? '...' : <><AlertCircle size={16} /> Undo Import</>}
                            </button>
                            <button onClick={() => { setReport(null); setFile(null); onClose(); onSuccess(); }} className="py-5 bg-slate-900 text-white rounded-[2rem] font-black uppercase text-[10px] tracking-[0.2em] hover:bg-blue-600 transition shadow-xl">
                                Selesai
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
