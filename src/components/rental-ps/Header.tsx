
import React from 'react';
import { Gamepad2 } from 'lucide-react';
import { PSStage } from './types';

interface HeaderProps {
    stage: PSStage;
    setStage: (s: PSStage) => void;
    onReset: () => void;
    canAccessSettings: boolean;
}

export const Header: React.FC<HeaderProps> = ({ stage, setStage, onReset, canAccessSettings }) => {
    return (
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
            <div className="space-y-1">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-900 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-slate-200">
                        <Gamepad2 size={24} />
                    </div>
                    <h1 className="text-4xl font-black uppercase italic tracking-tighter text-slate-900 leading-none">LEVEL UP PORTAL</h1>
                </div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] ml-1">Sistem Manajemen Rental PlayStation</p>
            </div>

            <div className="flex bg-white p-2 rounded-[2rem] shadow-xl shadow-slate-100 border border-slate-50">
                <button
                    onClick={() => { setStage('LIST'); onReset(); }}
                    className={`px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${stage === 'LIST' ? 'bg-slate-900 text-white shadow-xl shadow-slate-300' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    RIWAYAT
                </button>
                <button
                    onClick={() => { setStage('FORM'); onReset(); }}
                    className={`px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${stage === 'FORM' ? 'bg-slate-900 text-white shadow-xl shadow-slate-300' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    INPUT RENTAL
                </button>
                {canAccessSettings && (
                    <button
                        onClick={() => { setStage('SETTINGS'); onReset(); }}
                        className={`px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${stage === 'SETTINGS' ? 'bg-slate-900 text-white shadow-xl shadow-slate-300' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        PENGATURAN
                    </button>
                )}
            </div>
        </div>
    );
};
