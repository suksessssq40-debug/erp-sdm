import React, { useState, useEffect } from 'react';
import { TransactionCategory, TransactionType } from '../../types';
import { useToast } from '../Toast';

interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData: Partial<TransactionCategory>;
  onSave: (data: TransactionCategory) => Promise<void>;
  toast: ReturnType<typeof useToast>;
}

export const CategoryModal: React.FC<CategoryModalProps> = ({
  isOpen, onClose, initialData, onSave, toast
}) => {
  const [formData, setFormData] = useState<Partial<TransactionCategory>>(initialData);

  useEffect(() => {
    if (isOpen) setFormData(initialData);
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleSubmit = async () => {
      if (!formData.name) {
          toast.warning("Nama kategori wajib diisi");
          return;
      }
      await onSave(formData as TransactionCategory);
      onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/90 backdrop-blur-md p-4 animate-in fade-in duration-200">
        <div className="bg-white rounded-[3.5rem] w-full max-w-md p-10 shadow-2xl border border-white/20 animate-in zoom-in duration-300">
            <div className="flex justify-between items-center mb-8">
                <div>
                <h3 className="text-2xl font-black text-slate-800 leading-tight italic uppercase tracking-tighter">Tambah Kategori</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                    {formData.parentId ? 'SUB CATEGORY' : 'MAIN CATEGORY'} - {formData.type === TransactionType.IN ? 'INCOME' : 'EXPENSE'}
                </p>
                </div>
                <button onClick={onClose} className="p-4 bg-slate-100 rounded-2xl text-slate-400 hover:text-rose-500 transition">✕</button>
            </div>
            
            <div className="space-y-6">
                <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">NAMA KATEGORI</label>
                    <input 
                    className="w-full p-5 bg-slate-50 border-2 border-transparent rounded-[1.5rem] text-xs font-bold outline-none focus:border-blue-600 focus:bg-white transition shadow-sm"
                    placeholder="Contoh: Listrik, Gaji, Bonus..."
                    value={formData.name || ''}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    autoFocus
                    />
                </div>
                
                <button onClick={handleSubmit} className="w-full py-5 bg-slate-900 text-white rounded-[2rem] font-black uppercase tracking-[0.2em] hover:bg-blue-600 transition text-[10px] shadow-xl mt-4">
                    Simpan Kategori
                </button>
            </div>
        </div>
    </div>
  );
};
