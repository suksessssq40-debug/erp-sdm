import React, { useMemo, useState } from 'react';
import { TransactionCategory, TransactionType } from '../../types';
import { read, utils, writeFile } from 'xlsx';
import { FileSpreadsheet, FolderTree, Plus, Trash2, Folder } from 'lucide-react';
import { useToast } from '../Toast';

interface CategoryManagerProps {
  categories: TransactionCategory[];
  onAddCategoryClick: (type: TransactionType, parentId?: string | null) => void;
  onDeleteCategory: (id: string, name: string) => void;
  importCategories?: (cats: any[]) => Promise<void>;
  toast: ReturnType<typeof useToast>;
}

export const CategoryManager: React.FC<CategoryManagerProps> = ({
  categories, onAddCategoryClick, onDeleteCategory, importCategories, toast
}) => {
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);

  const groupedCategories = useMemo(() => {
    const income = categories.filter(c => c.type === TransactionType.IN && !c.parentId);
    const expense = categories.filter(c => c.type === TransactionType.OUT && !c.parentId);
    
    // Helper to get children
    const getChildren = (parentId: string) => categories.filter(c => c.parentId === parentId);

    return {
        IN: income.map(c => ({ ...c, children: getChildren(c.id) })),
        OUT: expense.map(c => ({ ...c, children: getChildren(c.id) }))
    };
  }, [categories]);

  const toggleExpand = (id: string) => {
    if (expandedCategories.includes(id)) {
        setExpandedCategories(expandedCategories.filter(ex => ex !== id));
    } else {
        setExpandedCategories([...expandedCategories, id]);
    }
  };

  const handleDownloadTemplate = () => {
    const headers = ["Name", "Type", "Parent"];
    const data = [
        { Name: "Contoh: Gaji Pokok", Type: "OUT", Parent: "Gaji & Tunjangan" },
        { Name: "Contoh: Penjualan Produk", Type: "IN", Parent: "" },
        { Name: "Contoh: Listrik & Air", Type: "OUT", Parent: "Operasional Kantor" },
    ];
    const ws = utils.json_to_sheet(data, { header: headers });
    ws['!cols'] = [{ wch: 30 }, { wch: 10 }, { wch: 30 }];
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Template Kategori");
    writeFile(wb, "Template_Import_Kategori.xlsx");
    toast.success("Template berhasil didownload");
  };

  const handleImportCategory = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
        const data = await file.arrayBuffer();
        const workbook = read(data);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = utils.sheet_to_json(sheet);
        
        const categoriesToImport: any[] = jsonData.map((row: any) => {
           const typeStr = (row['Type'] || row['Tipe'] || '').toString().toUpperCase();
           const type = typeStr.includes('IN') || typeStr.includes('MASUK') ? TransactionType.IN : TransactionType.OUT;
           return {
               name: row['Name'] || row['Nama'],
               type: type,
               parentName: row['Parent'] || row['Induk'] || null
           };
        }).filter(c => c.name);

        if (categoriesToImport.length === 0) {
           toast.warning("Tidak ada data kategori valid atau kolom 'Name' hilang.");
           return;
        }

        if (importCategories) {
            toast.info(`Mengimport ${categoriesToImport.length} kategori...`);
            await importCategories(categoriesToImport);
            toast.success("Import berhasil!");
        }
    } catch (err) {
        toast.error("Gagal memproses file import");
    }
    e.target.value = '';
  };

  const renderCategoryTree = (nodes: any[]) => {
    return nodes.map(node => (
       <div key={node.id} className="mb-2">
           <div className={`flex items-center justify-between p-4 rounded-[1.5rem] border transition-all ${expandedCategories.includes(node.id) ? 'bg-slate-50 border-blue-200' : 'bg-white border-slate-100 hover:border-slate-300'}`}>
               <div className="flex items-center gap-3 cursor-pointer select-none flex-1" onClick={() => toggleExpand(node.id)}>
                   <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${node.children.length > 0 ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
                       {node.children.length > 0 ? <FolderTree size={14} /> : <Folder size={14} />}
                   </div>
                   <span className="text-[10px] font-black uppercase tracking-widest text-slate-700">{node.name}</span>
                   {node.children.length > 0 && <span className="text-[9px] bg-slate-200 text-slate-500 px-2 py-0.5 rounded-full">{node.children.length} Sub</span>}
               </div>
               <div className="flex gap-2">
                   <button onClick={() => onAddCategoryClick(node.type, node.id)} className="p-2 text-emerald-500 hover:bg-emerald-50 rounded-lg" title="Tambah Sub Category"><Plus size={14} /></button>
                   <button onClick={() => onDeleteCategory(node.id, node.name)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg"><Trash2 size={14} /></button>
               </div>
           </div>
           
           {/* Recursive Children */}
           {expandedCategories.includes(node.id) && node.children.length > 0 && (
               <div className="ml-8 mt-2 pl-4 border-l-2 border-slate-100 space-y-2">
                   {renderCategoryTree(node.children)}
               </div>
           )}
       </div>
    ));
  };


  return (
    <div className="space-y-8 animate-in fly-in-bottom duration-500">
        <div className="bg-slate-900 p-10 rounded-[3rem] text-white shadow-2xl flex flex-col md:flex-row justify-between items-center relative overflow-hidden">
            <div className="relative z-10"> 
            <h4 className="text-3xl font-black italic uppercase">Master Kategori</h4>
            <p className="text-xs font-black text-slate-500 uppercase tracking-widest mt-2">ATUR STRUKTUR PENGELUARAN & PEMASUKAN UNTUK PELAPORAN YANG RAPI.</p>
            </div>
            
            <div className="flex gap-3 relative z-10 mt-6 md:mt-0">
                <button onClick={handleDownloadTemplate} className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition">
                    <FileSpreadsheet size={16} /> Download Template
                </button>
                <label className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 cursor-pointer transition shadow-xl shadow-blue-900/50">
                    <FolderTree size={16} /> Import Excel
                    <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleImportCategory} />
                </label>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* INCOME COLUMN */}
            <div className="bg-white p-8 rounded-[3rem] shadow-xl border border-slate-100">
                <div className="flex justify-between items-center mb-6 px-4">
                    <h5 className="text-emerald-600 font-black uppercase tracking-widest flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> Pemasukan (Income)</h5>
                    <button onClick={() => onAddCategoryClick(TransactionType.IN)} className="text-[10px] bg-emerald-50 text-emerald-600 px-3 py-2 rounded-xl font-bold hover:bg-emerald-100 transition flex items-center gap-1">
                        <Plus size={12} /> ADD ROOT
                    </button>
                </div>
                <div className="space-y-1">
                    {renderCategoryTree(groupedCategories.IN)}
                    {groupedCategories.IN.length === 0 && <p className="text-center text-[10px] text-slate-300 italic py-10">Belum ada kategori pemasukan</p>}
                </div>
            </div>

            {/* EXPENSE COLUMN */}
            <div className="bg-white p-8 rounded-[3rem] shadow-xl border border-slate-100">
                <div className="flex justify-between items-center mb-6 px-4">
                    <h5 className="text-rose-600 font-black uppercase tracking-widest flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-rose-500"></div> Pengeluaran (Expense)</h5>
                    <button onClick={() => onAddCategoryClick(TransactionType.OUT)} className="text-[10px] bg-rose-50 text-rose-600 px-3 py-2 rounded-xl font-bold hover:bg-rose-100 transition flex items-center gap-1">
                        <Plus size={12} /> ADD ROOT
                    </button>
                </div>
                <div className="space-y-1">
                    {renderCategoryTree(groupedCategories.OUT)}
                    {groupedCategories.OUT.length === 0 && <p className="text-center text-[10px] text-slate-300 italic py-10">Belum ada kategori pengeluaran</p>}
                </div>
            </div>
        </div>
    </div>
  );
};
