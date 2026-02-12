import { MapPin, User as UserIcon, Gamepad2, Clock, CreditCard, ChevronRight, Receipt } from 'lucide-react';
import { RentalPsOutlet } from './types';

interface FormProps {
    customerName: string;
    setCustomerName: (v: string) => void;
    psType: string;
    setPsType: (v: string) => void;
    duration: string;
    setDuration: (v: string) => void;
    paymentMethod: 'CASH' | 'TRANSFER' | 'SPLIT';
    setPaymentMethod: (v: 'CASH' | 'TRANSFER' | 'SPLIT') => void;
    cashPart: string;
    setCashPart: (v: string) => void;
    transferPart: string;
    setTransferPart: (v: string) => void;
    calculateTotal: () => number;
    prices: Record<string, number>;
    isSubmitting: boolean;
    isEditing?: boolean;
    handleSubmit: (e: React.FormEvent) => void;
    outlets: RentalPsOutlet[];
    selectedOutletId: string;
    setSelectedOutletId: (v: string) => void;
}

export const Form: React.FC<FormProps> = ({
    customerName, setCustomerName, psType, setPsType, duration, setDuration,
    paymentMethod, setPaymentMethod, cashPart, setCashPart, transferPart, setTransferPart,
    calculateTotal, prices, isSubmitting, isEditing, handleSubmit,
    outlets, selectedOutletId, setSelectedOutletId
}) => {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* INPUT FORM */}
            <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100">
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                <MapPin size={12} className="text-blue-500" /> Pilih Outlet
                            </label>
                            <select
                                value={selectedOutletId}
                                onChange={e => setSelectedOutletId(e.target.value)}
                                className="w-full bg-slate-50 border-none rounded-2xl p-4 font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 transition-all"
                                required
                            >
                                <option value="" disabled>-- Pilih Outlet --</option>
                                {outlets.map(o => (
                                    <option key={o.id} value={o.id}>{o.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                <UserIcon size={12} className="text-blue-500" /> Nama Customer
                            </label>
                            <input
                                type="text"
                                value={customerName}
                                onChange={e => setCustomerName(e.target.value)}
                                className="w-full bg-slate-50 border-none rounded-2xl p-4 font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 placeholder:text-slate-300 transition-all"
                                placeholder="Contoh: Pak Jaka"
                                required
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                <Gamepad2 size={12} className="text-blue-500" /> Jenis PS
                            </label>

                            <select
                                value={psType}
                                onChange={e => setPsType(e.target.value)}
                                className="w-full bg-slate-50 border-none rounded-2xl p-4 font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 font-mono"
                            >
                                {Object.keys(prices).length > 0 ? (
                                    Object.keys(prices).sort().map(name => (
                                        <option key={name} value={name}>{name}</option>
                                    ))
                                ) : (
                                    <option value="">(Atur Harga Dulu)</option>
                                )}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                <Clock size={12} className="text-blue-500" /> Durasi (Jam)
                            </label>
                            <input
                                type="number"
                                step="0.5"
                                value={duration}
                                onChange={e => setDuration(e.target.value)}
                                className="w-full bg-slate-50 border-none rounded-2xl p-4 font-bold text-slate-700 focus:ring-2 focus:ring-blue-500"
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-4">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                            <CreditCard size={12} className="text-blue-500" /> Metode Pembayaran
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            {(['CASH', 'TRANSFER', 'SPLIT'] as const).map(m => (
                                <button
                                    key={m}
                                    type="button"
                                    onClick={() => setPaymentMethod(m)}
                                    className={`py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest border-2 transition-all ${paymentMethod === m ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-white border-slate-100 text-slate-400 hover:border-blue-200'}`}
                                >
                                    {m}
                                </button>
                            ))}
                        </div>

                        {paymentMethod === 'SPLIT' && (
                            <div className="grid grid-cols-2 gap-4 animate-in zoom-in duration-300">
                                <div className="space-y-1">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Porsi Tunai (Cash)</p>
                                    <input
                                        type="number"
                                        value={cashPart}
                                        onChange={e => setCashPart(e.target.value)}
                                        className="w-full bg-emerald-50/50 border-emerald-100 border text-emerald-700 rounded-xl p-3 font-bold"
                                        placeholder="0"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Porsi Transfer (TF)</p>
                                    <input
                                        type="number"
                                        value={transferPart}
                                        onChange={e => setTransferPart(e.target.value)}
                                        className="w-full bg-blue-50/50 border-blue-100 border text-blue-700 rounded-xl p-3 font-bold"
                                        placeholder="0"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="pt-4 border-t border-slate-100">
                        <div className="flex justify-between items-center mb-6">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Pembayaran</p>
                            <p className="text-3xl font-black text-slate-900 tracking-tighter italic">Rp {calculateTotal().toLocaleString()}</p>
                        </div>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full bg-slate-900 text-white py-6 rounded-[2rem] font-black text-xs uppercase tracking-[0.3em] shadow-2xl shadow-slate-300 hover:bg-black active:scale-[0.98] transition-all flex items-center justify-center gap-3"
                        >
                            {isSubmitting ? (
                                <>
                                    <div className="w-5 h-5 border-4 border-white/20 border-t-white rounded-full animate-spin" />
                                    MENYIMPAN...
                                </>
                            ) : (
                                <>
                                    {isEditing ? 'PERBARUI DATA & SINKRON KAS' : 'SELESAI & POST KE FINANCE'}
                                    <ChevronRight size={18} />
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>

            {/* PREVIEW / INFO AREA */}
            <div className="hidden lg:flex flex-col gap-6">
                <div className="bg-blue-600 text-white p-8 rounded-[2.5rem] shadow-xl shadow-blue-200 relative overflow-hidden group">
                    <div className="absolute -right-10 -bottom-10 opacity-10 group-hover:scale-110 transition-transform duration-700">
                        <Gamepad2 size={240} />
                    </div>
                    <div className="relative z-10">
                        <h3 className="text-xl font-black uppercase italic mb-4">Informasi Billing</h3>
                        <div className="space-y-4 text-blue-50/80">
                            <div className="flex justify-between border-b border-white/10 pb-2">
                                <span className="text-[10px] font-black uppercase tracking-widest">Jenis Rental</span>
                                <span className="font-bold text-white">{psType}</span>
                            </div>

                            <div className="flex justify-between border-b border-white/10 pb-2">
                                <span className="text-[10px] font-black uppercase tracking-widest">Tarif Per Jam</span>
                                <span className="font-bold text-white">Rp {(prices[psType] || 0).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between border-b border-white/10 pb-2">
                                <span className="text-[10px] font-black uppercase tracking-widest">Durasi Sewa</span>
                                <span className="font-bold text-white">{duration} Jam</span>
                            </div>
                        </div>
                        <div className="mt-8 bg-white/10 p-4 rounded-2xl backdrop-blur-sm border border-white/10">
                            <p className="text-[9px] font-black uppercase tracking-widest mb-1 text-blue-200">Catatan Otomatis:</p>
                            <p className="text-[11px] leading-relaxed">Sistem akan secara otomatis mencatat jurnal piutang dan pendapatan ke portal SDM. Finance akan melihat setoran PS ini secara langsung.</p>
                        </div>
                    </div>
                </div>

                <div className="bg-slate-900 text-white p-8 rounded-[2.5rem] shadow-xl grow flex flex-col items-center justify-center text-center space-y-4">
                    <Receipt className="text-blue-500" size={48} />
                    <h3 className="text-xl font-black uppercase italic">Nota Digital Ready</h3>
                    <p className="text-slate-400 text-xs text-balance">Setelah disimpan, nota dengan format LUG Romawi akan otomatis dihasilkan.</p>
                </div>
            </div>
        </div>
    );
};
