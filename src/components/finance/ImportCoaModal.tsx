import React, { useState } from 'react';
import { X, Upload, FileSpreadsheet, Download, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

interface ImportCoaModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    toast: any;
}

export const ImportCoaModal: React.FC<ImportCoaModalProps> = ({ isOpen, onClose, onSuccess, toast }) => {
    const [file, setFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [results, setResults] = useState<{ message: string, errors?: string[] } | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setResults(null);
        }
    };

    const handleUpload = async () => {
        if (!file) return;

        const token = localStorage.getItem('sdm_erp_auth_token');
        if (!token) {
            toast.error("Sesi habis. Silakan login ulang.");
            return;
        }

        setIsUploading(true);
        setResults(null);

        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch('/api/finance/coa/import', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            const data = await res.json();
            if (res.ok) {
                setResults({ message: data.message, errors: data.errors });
                toast.success("Import Berhasil!");
                onSuccess();
            } else {
                const errorMsg = data.error || "Gagal mengimport.";
                toast.error(errorMsg);
                setResults({ message: errorMsg, errors: data.details || data.errors });
            }
        } catch (e: any) {
            console.error("Import Error:", e);
            toast.error("Terjadi kesalahan koneksi.");
            setResults({ message: "Terjadi kesalahan koneksi ke server.", errors: [e.message] });
        } finally {
            setIsUploading(false);
        }
    };

    const downloadTemplate = async () => {
        try {
            const token = localStorage.getItem('sdm_erp_auth_token') || '';
            if (!token) {
                toast.error("Sesi habis. Silakan login ulang.");
                return;
            }
            const res = await fetch('/api/finance/coa/template', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error("Gagal download template");
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'Template_Import_COA.xlsx';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
        } catch (e) {
            toast.error("Gagal mendownload template.");
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                <div className="p-8 flex justify-between items-center border-b border-slate-100">
                    <div>
                        <h2 className="text-2xl font-black text-slate-800 tracking-tight">Import Daftar Akun</h2>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Upload Excel Chart of Accounts</p>
                    </div>
                    <button onClick={onClose} className="p-3 hover:bg-slate-100 rounded-2xl transition">
                        <X size={24} className="text-slate-400" />
                    </button>
                </div>

                <div className="p-8 space-y-6">
                    {/* Template Section */}
                    <div className="bg-blue-50 p-6 rounded-3xl border border-blue-100 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600">
                                <FileSpreadsheet size={24} />
                            </div>
                            <div>
                                <p className="text-sm font-black text-blue-900">Belum punya template?</p>
                                <p className="text-[10px] font-bold text-blue-500 uppercase tracking-tight">Gunakan format standar kami</p>
                            </div>
                        </div>
                        <button
                            onClick={downloadTemplate}
                            className="bg-white text-blue-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm hover:shadow-md transition flex items-center gap-2"
                        >
                            <Download size={14} /> Download
                        </button>
                    </div>

                    {/* Upload Section */}
                    {!results ? (
                        <div
                            className={`border-2 border-dashed rounded-[2rem] p-10 flex flex-col items-center justify-center space-y-4 transition ${file ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}
                        >
                            <div className={`w-16 h-16 rounded-full flex items-center justify-center ${file ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                                <Upload size={32} />
                            </div>
                            <div className="text-center">
                                <p className="text-sm font-bold text-slate-600">{file ? file.name : 'Pilih file excel (.xlsx)'}</p>
                                <p className="text-[10px] font-medium text-slate-400 mt-1">Format: .xlsx (Excel WorkBook)</p>
                            </div>
                            <input
                                type="file"
                                accept=".xlsx"
                                onChange={handleFileChange}
                                className="hidden"
                                id="coa-upload"
                            />
                            <label
                                htmlFor="coa-upload"
                                className="bg-slate-900 text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest cursor-pointer hover:bg-slate-800 transition shadow-lg"
                            >
                                {file ? 'GANTI FILE' : 'PILIH FILE'}
                            </label>
                        </div>
                    ) : (
                        <div className={`p-6 rounded-3xl border ${results.errors ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}>
                            <div className="flex items-center gap-3 mb-4">
                                {results.errors ? <AlertCircle className="text-amber-600" /> : <CheckCircle2 className="text-emerald-600" />}
                                <p className={`text-sm font-black ${results.errors ? 'text-amber-900' : 'text-emerald-900'}`}>{results.message}</p>
                            </div>
                            {results.errors && results.errors.length > 0 && (
                                <div className="max-h-40 overflow-y-auto space-y-1 pr-2 custom-scrollbar">
                                    {results.errors.map((err, idx) => (
                                        <p key={idx} className="text-[10px] font-medium text-amber-700">• {err}</p>
                                    ))}
                                </div>
                            )}
                            <button
                                onClick={() => { setFile(null); setResults(null); }}
                                className="mt-4 text-[10px] font-black uppercase text-slate-500 hover:text-slate-800"
                            >
                                ← Coba Lagi / Clear
                            </button>
                        </div>
                    )}

                    <div className="flex gap-4">
                        <button
                            disabled={isUploading}
                            onClick={onClose}
                            className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-200 transition"
                        >
                            Tutup
                        </button>
                        {file && !results && (
                            <button
                                onClick={handleUpload}
                                disabled={isUploading}
                                className="flex-1 py-4 bg-blue-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-blue-700 transition shadow-xl shadow-blue-100 flex items-center justify-center gap-2"
                            >
                                {isUploading ? <><Loader2 size={16} className="animate-spin" /> Sedang Proses...</> : 'MULAI IMPORT'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
