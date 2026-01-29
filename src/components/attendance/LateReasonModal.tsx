
import React from 'react';
import { AlertCircle, ArrowRight } from 'lucide-react';

interface LateReasonModalProps {
    lateReason: string;
    setLateReason: (val: string) => void;
    onContinue: () => void;
}

export const LateReasonModal: React.FC<LateReasonModalProps> = ({ lateReason, setLateReason, onContinue }) => {
    return (
        <div className="w-full max-w-md space-y-8 animate-in slide-in-from-bottom duration-500 bg-white p-10 rounded-[3.5rem] shadow-2xl border border-slate-100 h-full flex flex-col justify-center">
            <div className="bg-rose-50 p-8 rounded-[2.5rem] flex items-start space-x-5 text-left border border-rose-100 shadow-sm">
                <div className="w-12 h-12 bg-rose-500 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-lg shadow-rose-200">
                    <AlertCircle size={24} />
                </div>
                <div>
                    <h4 className="font-black text-rose-900 uppercase text-xs tracking-widest italic">Deteksi Keterlambatan</h4>
                    <p className="text-xs text-rose-600 font-bold mt-1 leading-relaxed">
                        Sistem mencatat kehadiran Anda melewati batas toleransi. Harap menyertakan alasan singkat sebagai bahan pertimbangan evaluasi.
                    </p>
                </div>
            </div>

            <div className="space-y-3">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">ALASAN / KETERANGAN</p>
                <textarea
                    className="w-full p-8 bg-slate-50 border-2 border-slate-100 rounded-[2.5rem] focus:border-rose-500 focus:bg-white outline-none h-40 text-sm font-bold transition-all shadow-inner"
                    placeholder="Contoh: Macet parah, Ban bocor, atau kendala lainnya..."
                    value={lateReason}
                    onChange={e => setLateReason(e.target.value)}
                />
            </div>

            <button
                disabled={!lateReason.trim()}
                onClick={onContinue}
                className="w-full bg-slate-900 text-white py-6 rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] shadow-xl disabled:opacity-30 hover:bg-rose-600 transition-all active:scale-95 flex items-center justify-center gap-3"
            >
                LANJUTKAN KE SELFIE
                <ArrowRight size={18} />
            </button>
        </div>
    );
};
