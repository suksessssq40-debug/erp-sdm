import React, { useState } from 'react';
import { Transaction, TransactionType, BusinessUnit } from '../../types';
import { formatCurrency } from '../../utils';
import { Search, Landmark, Edit, Trash2, ImageIcon } from 'lucide-react';

interface JournalViewProps {
  transactions: Transaction[];
  businessUnits: BusinessUnit[];
  
  onEdit: (t: Transaction) => void;
  onDelete: (t: Transaction) => void;
}

export const JournalView: React.FC<JournalViewProps> = ({
  transactions, businessUnits, onEdit, onDelete
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const filteredTransactions = transactions.filter(t => 
      !searchTerm || t.description.toLowerCase().includes(searchTerm.toLowerCase()) || 
      t.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <>
    <div className="bg-white rounded-[3rem] shadow-xl border border-slate-100 overflow-hidden animate-in fade-in duration-500">
        <div className="p-10 border-b flex flex-col md:flex-row justify-between items-center gap-6 bg-slate-50/30">
        <div>
            <h4 className="text-2xl font-black text-slate-800 italic uppercase tracking-tighter">Jurnal Transaksi</h4>
            <p className="text-[10px] text-slate-400 uppercase font-black tracking-[0.3em] mt-1">LOG TRANSAKSI KRONOLOGIS</p>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-72">
                <Search size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" />
                <input 
                  className="w-full pl-12 pr-6 py-4 bg-white border-2 border-slate-50 rounded-[1.5rem] text-xs font-bold focus:border-blue-600 outline-none transition shadow-sm" 
                  placeholder="Cari keterangan..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
            </div>
        </div>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full text-left">
            <thead>
            <tr className="bg-slate-50/50 text-slate-400 text-[9px] font-black uppercase tracking-[0.2em] border-b border-slate-100">
                <th className="px-10 py-6">TANGGAL</th>
                <th className="px-10 py-6">ACCOUNT</th>
                <th className="px-10 py-6">DESKRIPSI</th>
                <th className="px-10 py-6">KATEGORI</th>
                <th className="px-10 py-6">UNIT (KB)</th>
                <th className="px-10 py-6 text-right">NOMINAL</th>
                <th className="px-10 py-6 text-center">AKSI</th>
            </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
            {filteredTransactions.map(t => (
                <tr key={t.id} className="hover:bg-blue-50/30 transition-colors group">
                <td className="px-10 py-7 text-[10px] font-black text-slate-400 uppercase tracking-widest">{new Date(t.date).toLocaleDateString('id-ID', {day: '2-digit', month: 'short'})}</td>
                <td className="px-10 py-7">
                    <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center">
                        <Landmark size={12} />
                    </div>
                    <span className="text-[10px] font-black text-slate-700 uppercase">{t.account}</span>
                    </div>
                </td>
                <td className="px-10 py-7 text-xs font-bold text-slate-600 italic">"{t.description}"</td>
                <td className="px-10 py-7">
                    <span className="bg-white border border-slate-100 text-slate-500 px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-[0.15em]">{t.category || 'GENERAL'}</span>
                </td>
                <td className="px-10 py-7">
                    {t.businessUnitId ? (
                        <span className="bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-[0.15em]">
                            {businessUnits.find(u => u.id === t.businessUnitId)?.name || 'UNKNOWN'}
                        </span>
                    ) : <span className="text-slate-300">-</span>}
                </td>
                <td className={`px-10 py-7 text-sm font-black text-right ${t.type === TransactionType.IN ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {t.type === TransactionType.IN ? '+' : '-'}{formatCurrency(t.amount)}
                </td>
                <td className="px-10 py-7 text-center">
                    <div className="flex items-center justify-center gap-2">
                    {t.imageUrl && (
                        <button onClick={() => setPreviewImage(t.imageUrl!)} className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition">
                            <ImageIcon size={14} />
                        </button>
                    )}
                    <button onClick={() => onEdit(t)} className="p-2 bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-500 hover:text-white transition">
                        <Edit size={14} />
                    </button>
                    <button onClick={() => onDelete(t)} className="p-2 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-500 hover:text-white transition">
                        <Trash2 size={14} />
                    </button>
                    </div>
                </td>
                </tr>
            ))}
            {filteredTransactions.length === 0 && (
                <tr>
                <td colSpan={7} className="px-10 py-20 text-center text-slate-400 text-xs font-black uppercase tracking-widest">
                    TIDAK ADA TRANSAKSI PADA PERIODE INI
                </td>
                </tr>
            )}
            </tbody>
        </table>
        </div>
    </div>
    
    {/* Image Preview Overlay */}
      {previewImage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/95 backdrop-blur-xl p-8 animate-in fade-in duration-200" onClick={() => setPreviewImage(null)}>
           <div className="max-w-4xl w-full max-h-full flex flex-col items-center">
              <img src={previewImage} className="max-w-full max-h-[85vh] object-contain rounded-[3rem] shadow-2xl border-8 border-white/10" alt="Bukti Pembayaran" />
              <button onClick={() => setPreviewImage(null)} className="mt-8 px-12 py-4 bg-white text-slate-900 rounded-[1.5rem] font-black uppercase tracking-widest shadow-2xl hover:bg-blue-600 hover:text-white transition">TUTUP PREVIEW</button>
           </div>
        </div>
      )}
    </>
  );
};
