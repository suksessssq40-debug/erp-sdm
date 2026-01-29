
import React from 'react';
import { CheckCircle2 } from 'lucide-react';

interface AttendanceSuccessProps {
    onBack: () => void;
    isCheckOut: boolean;
    quote: string;
}

export const AttendanceSuccess: React.FC<AttendanceSuccessProps> = ({ onBack, isCheckOut, quote }) => {
    return (
        <div className="flex flex-col items-center justify-center text-center p-10 animate-in zoom-in duration-500 min-h-[500px] h-full bg-white rounded-[3rem]">
            <div className="w-28 h-28 bg-emerald-100 rounded-[3rem] flex items-center justify-center text-emerald-600 shadow-xl shadow-emerald-50 mb-10 mx-auto relative group">
                <CheckCircle2 size={56} className="group-hover:scale-110 transition-transform" />
                <div className="absolute inset-0 bg-emerald-400/20 rounded-[3rem] animate-ping -z-10 duration-[2000ms]" />
            </div>

            <h3 className="text-4xl font-black text-slate-800 tracking-tighter mb-4 uppercase italic">
                Data {isCheckOut ? 'Pulang' : 'Masuk'} Tercatat!
            </h3>

            <div className="max-w-md mx-auto mb-12">
                <p className="text-slate-500 font-bold uppercase tracking-[0.2em] text-[10px] mb-4">MESSAGES FROM SYSTEM</p>
                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 italic font-bold text-slate-700 leading-relaxed shadow-inner">
                    "{quote}"
                </div>
            </div>

            <button
                onClick={onBack}
                className="group flex items-center gap-3 text-blue-600 font-black uppercase text-xs tracking-[0.3em] hover:text-blue-700 transition-all"
            >
                <span className="group-hover:-translate-x-1 transition-transform">←</span>
                KEMBALI KE PORTAL UTAMA
            </button>
        </div>
    );
};
