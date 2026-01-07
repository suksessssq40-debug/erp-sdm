import React from 'react';
import { BusinessUnit } from '../../types';
import { Plus, Edit, Trash2, Building2 } from 'lucide-react';

interface BusinessUnitManagerProps {
  businessUnits: BusinessUnit[];
  onAddClick: () => void;
  onEditClick: (unit: BusinessUnit) => void;
  onDeleteClick: (id: string, name: string) => void;
}

export const BusinessUnitManager: React.FC<BusinessUnitManagerProps> = ({
  businessUnits, onAddClick, onEditClick, onDeleteClick
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in zoom-in duration-500">
        <div className="md:col-span-2 bg-gradient-to-r from-indigo-900 to-slate-900 p-10 rounded-[3rem] text-white shadow-2xl flex justify-between items-center relative overflow-hidden">
        <div className="relative z-10">
            <h4 className="text-3xl font-black italic uppercase">Manajemen KB Pos (Unit Bisnis)</h4>
            <p className="text-xs font-black text-indigo-300 uppercase tracking-widest mt-2 max-w-xl">PISAHKAN ALIRAN KAS UNTUK SETIAP USAHA ANDA DALAM SATU DASHBOARD.</p>
        </div>
        <button onClick={onAddClick} className="relative z-10 px-8 py-4 bg-white text-indigo-900 rounded-2xl font-black uppercase tracking-widest hover:bg-indigo-50 transition shadow-xl flex items-center gap-2">
            <Plus size={18} /> Tambah Unit Baru
        </button>
        </div>

        <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {(businessUnits || []).length === 0 && <p className="text-center text-slate-400 col-span-full py-20 italic">Belum ada Unit Bisnis / KB Pos</p>}
        {businessUnits.map(unit => (
            <div key={unit.id} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl transition group relative overflow-hidden">
                <div className="flex justify-between items-start mb-6">
                    <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
                        <Building2 size={24} />
                    </div>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition">
                        <button onClick={() => onEditClick(unit)} className="p-2 bg-amber-50 text-amber-500 rounded-xl hover:bg-amber-100"><Edit size={16} /></button>
                        <button onClick={() => onDeleteClick(unit.id, unit.name)} className="p-2 bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-100"><Trash2 size={16} /></button>
                    </div>
                </div>
                <h5 className="text-xl font-black text-slate-800 uppercase italic mb-2">{unit.name}</h5>
                <p className="text-xs font-bold text-slate-400 line-clamp-2">{unit.description || 'Tidak ada deskripsi'}</p>
                
                <div className="mt-6 pt-6 border-t border-slate-50 flex justify-between items-center">
                    <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${unit.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                        {unit.isActive ? 'AKTIF' : 'NON-AKTIF'}
                    </span>
                    <span className="text-[9px] font-black text-indigo-300 uppercase tracking-widest">ID: {unit.id.substr(0, 6)}</span>
                </div>
            </div>
        ))}
        </div>
    </div>
  );
};
