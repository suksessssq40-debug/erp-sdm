
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { User } from '@/types';
import { useToast } from '../Toast';
import { LoadingState } from '../LoadingState';
import { RentalRecord, PSStage, RentalPsPrice, RentalPsOutlet } from './types';
import { Header } from './Header';
import { Form } from './Form';
import { History } from './History';
import { Receipt } from './Receipt';
import { Settings } from './Settings';
import { CheckCircle2, Download, Share2, X, Share, Info, FileText, AlertCircle } from 'lucide-react';

interface RentalPSPortalProps {
    currentUser: User;
}

const RentalPSPortal: React.FC<RentalPSPortalProps> = ({ currentUser }) => {
    const toast = useToast();
    const [stage, setStage] = useState<PSStage>('LIST');
    const [isLoading, setIsLoading] = useState(true);
    const [history, setHistory] = useState<RentalRecord[]>([]);
    const [outlets, setOutlets] = useState<RentalPsOutlet[]>([]);
    const [rentalPrices, setRentalPrices] = useState<RentalPsPrice[]>([]);
    const [lastCreated, setLastCreated] = useState<RentalRecord | null>(null);
    const [selectedRecord, setSelectedRecord] = useState<RentalRecord | null>(null);
    const [selectedOutletId, setSelectedOutletId] = useState<string>('');

    // Dashboard & Filter States
    const [stats, setStats] = useState({ totalRevenue: 0, totalCash: 0, totalTransfer: 0, count: 0 });
    const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
    const [isImporting, setIsImporting] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [isFiltering, setIsFiltering] = useState(false);
    const [isGuideOpen, setIsGuideOpen] = useState(false);

    // Form State
    const [customerName, setCustomerName] = useState('');
    const [psType, setPsType] = useState('');
    const [duration, setDuration] = useState('1');
    const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'TRANSFER' | 'SPLIT'>('CASH');
    const [cashPart, setCashPart] = useState('');
    const [transferPart, setTransferPart] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editingRecord, setEditingRecord] = useState<RentalRecord | null>(null);

    // Permission Check
    const canAccessSettings = useMemo(() => {
        return ['OWNER', 'MANAGER', 'FINANCE', 'STAFF'].includes(currentUser.role);
    }, [currentUser.role]);

    // Map prices for the Form component
    const pricesMap = useMemo(() => {
        const map: Record<string, number> = {};
        rentalPrices.forEach(p => {
            map[p.name] = p.pricePerHour;
        });
        return map;
    }, [rentalPrices]);

    const calculateTotal = () => (pricesMap[psType] || 0) * parseFloat(duration || '0');

    const fetchOutlets = async () => {
        try {
            const token = localStorage.getItem('sdm_erp_auth_token');
            const res = await fetch('/api/rental-ps/outlets', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setOutlets(data);
                if (data.length > 0 && !selectedOutletId) {
                    setSelectedOutletId(data[0].id);
                }
            }
        } catch (e) {
            console.error("Failed to fetch outlets");
        }
    };

    const fetchPrices = async (outletId?: string) => {
        const targetOutlet = outletId || selectedOutletId;
        if (!targetOutlet) return;

        try {
            const token = localStorage.getItem('sdm_erp_auth_token');
            const res = await fetch(`/api/rental-ps/prices?outletId=${targetOutlet}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setRentalPrices(data);
                if (data.length > 0) {
                    const exists = data.find((p: any) => p.name === psType);
                    if (!exists) setPsType(data[0].name);
                }
            }
        } catch (e) {
            console.error("Failed to fetch prices");
        }
    };

    const fetchHistory = async () => {
        setIsFiltering(true);
        try {
            const token = localStorage.getItem('sdm_erp_auth_token');
            const params = new URLSearchParams({
                limit: '100'
            });
            if (dateRange.startDate) params.append('startDate', dateRange.startDate);
            if (dateRange.endDate) params.append('endDate', dateRange.endDate);
            if (selectedOutletId) params.append('outletId', selectedOutletId);

            const res = await fetch(`/api/rental-ps?${params.toString()}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setHistory(data.records);
                setStats(data.stats);
            }
        } catch (e) {
            toast.error("Gagal mengambil riwayat rental");
        } finally {
            setIsFiltering(false);
            setIsLoading(false);
        }
    };

    const loadAll = async () => {
        setIsLoading(true);
        await Promise.all([fetchOutlets()]);
        await fetchHistory();
        setIsLoading(false);
    };

    useEffect(() => {
        if (selectedOutletId) {
            fetchPrices(selectedOutletId);
        }
    }, [selectedOutletId]);

    useEffect(() => {
        loadAll();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!customerName) return toast.error("Nama customer wajib diisi");
        if (!psType) return toast.error("Pilih tipe PS");

        setIsSubmitting(true);
        const totalAmount = calculateTotal();

        const payload = {
            customerName: customerName.trim(),
            psType,
            duration: parseFloat(duration),
            paymentMethod,
            totalAmount,
            cashAmount: paymentMethod === 'SPLIT' ? parseFloat(cashPart || '0') : (paymentMethod === 'CASH' ? totalAmount : 0),
            transferAmount: paymentMethod === 'SPLIT' ? parseFloat(transferPart || '0') : (paymentMethod === 'TRANSFER' ? totalAmount : 0),
            outletId: selectedOutletId
        };

        try {
            const token = localStorage.getItem('sdm_erp_auth_token');
            const res = await fetch('/api/rental-ps', {
                method: editingRecord ? 'PUT' : 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    ...payload,
                    id: editingRecord?.id
                })
            });

            if (res.ok) {
                const saved = await res.json();
                setLastCreated(saved);
                setStage('SUCCESS');
                toast.success(editingRecord ? "Transaksi Diperbarui!" : "Rental Berhasil Dicatat!");
                fetchHistory();

                setCustomerName('');
                setDuration('1');
                setCashPart('');
                setTransferPart('');
                setEditingRecord(null);
            } else {
                const err = await res.json();
                toast.error(err.error || "Gagal menyimpan rental");
            }
        } catch (e) {
            toast.error("Terjadi kesalahan sistem");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEdit = (record: RentalRecord) => {
        setEditingRecord(record);
        setCustomerName(record.customerName);
        setPsType(record.psType);
        setDuration(record.duration.toString());
        setPaymentMethod(record.paymentMethod as any);
        setCashPart(record.cashAmount > 0 ? record.cashAmount.toString() : '');
        setTransferPart(record.transferAmount > 0 ? record.transferAmount.toString() : '');
        setSelectedOutletId(record.outletId);
        setStage('FORM');
    };

    const handleDelete = async (record: RentalRecord) => {
        if (!confirm(`Hapus transaksi ${record.invoiceNumber}?`)) return;

        try {
            const token = localStorage.getItem('sdm_erp_auth_token');
            const res = await fetch(`/api/rental-ps?id=${record.id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                toast.success("Transaksi Dihapus");
                fetchHistory();
            } else {
                const err = await res.json();
                toast.error(err.error || "Gagal menghapus transaksi");
            }
        } catch (e) {
            toast.error("Terjadi kesalahan sistem");
        }
    };

    const handleImport = async () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.xlsx,.csv';
        input.onchange = async (e: any) => {
            const file = e.target.files[0];
            if (!file) return;

            setIsImporting(true);
            try {
                const reader = new FileReader();
                reader.onload = async (event: any) => {
                    try {
                        let records = [];
                        const data = event.target.result;

                        // Use XLSX library to parse the file
                        const { read, utils } = await import('xlsx');
                        const workbook = read(data, { type: 'binary', cellDates: true, cellNF: false, cellText: false });
                        const sheetName = workbook.SheetNames[0];
                        const worksheet = workbook.Sheets[sheetName];
                        const rawRecords = utils.sheet_to_json(worksheet);

                        // Helper untuk konversi serial date Excel ke JS Date jika masih angka
                        const excelToJSDate = (serial: any) => {
                            if (!serial) return null;
                            if (serial instanceof Date) return serial; // Sudah jadi Date berkat cellDates: true
                            if (typeof serial === 'number') {
                                // Excel epoch starts 1899-12-30
                                return new Date(Math.round((serial - 25569) * 86400 * 1000));
                            }
                            const d = new Date(serial);
                            return isNaN(d.getTime()) ? null : d;
                        };

                        // Mapping header excel ke key yang dimengerti backend
                        records = rawRecords.map((rec: any) => {
                            const findVal = (possibleKeys: string[]) => {
                                const key = Object.keys(rec).find(k =>
                                    possibleKeys.some(pk => k.toLowerCase().includes(pk.toLowerCase()))
                                );
                                return key ? rec[key] : null;
                            };

                            const rawDate = findVal(['tanggal', 'date']);
                            const date = excelToJSDate(rawDate);

                            return {
                                date: date ? date.toISOString() : null,
                                customer: findVal(['customer', 'pelanggan', 'nama']),
                                unit: findVal(['unit', 'ps']),
                                duration: findVal(['durasi', 'duration', 'jam']),
                                cashAmount: findVal(['cash', 'tunai']),
                                transferAmount: findVal(['transfer', 'tf', 'bank']),
                                totalAmount: findVal(['total', 'nominal', 'jumlah']),
                                paymentMethod: findVal(['metode', 'payment']),
                                outlet: findVal(['outlet', 'cabang']),
                                petugas: findVal(['petugas', 'staff', 'admin'])
                            };
                        });

                        if (records.length === 0) throw new Error("Tidak ada data dalam file");

                        const token = localStorage.getItem('sdm_erp_auth_token');
                        const res = await fetch('/api/rental-ps/import', {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${token}`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({ records })
                        });

                        if (res.ok) {
                            const result = await res.json();
                            if (result.failed > 0) {
                                toast.warning(`Berhasil: ${result.count}, Gagal: ${result.failed}. Cek log error.`);
                            } else {
                                toast.success(`🔥 Berhasil mengimpor ${result.count} data transaksi!`);
                            }
                            fetchHistory();
                        } else {
                            const err = await res.json();
                            toast.error(err.error || "Gagal mengimpor data");
                        }
                    } catch (e: any) {
                        toast.error(e.message || "File tidak valid");
                    }
                };
                reader.readAsBinaryString(file);
            } catch (e) {
                toast.error("Gagal membaca file");
            } finally {
                setIsImporting(false);
            }
        };
        input.click();
    };

    const downloadTemplate = async () => {
        try {
            toast.info("Sedang menyiapkan template Excel...");
            const token = localStorage.getItem('sdm_erp_auth_token');
            const res = await fetch('/api/rental-ps/import/template?type=template', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'Template_Import_Rental_LevelUp.xlsx';
                document.body.appendChild(a);
                a.click();
                a.remove();
                toast.success("Template Excel berhasil diunduh!");
            } else {
                toast.error("Gagal mengunduh template");
            }
        } catch (e) {
            toast.error("Terjadi kesalahan sistem");
        }
    };

    const handleExport = () => {
        if (history.length === 0) return toast.error("Tidak ada data untuk dieksport");

        setIsExporting(true);
        try {
            const headers = ["Nota", "Tanggal", "Customer", "Unit", "Durasi", "Total", "Metode", "Outlet", "Petugas"];
            const csvContent = [
                headers.join(","),
                ...history.map(r => [
                    r.invoiceNumber,
                    new Date(r.createdAt).toLocaleString(),
                    `"${r.customerName}"`,
                    r.psType,
                    r.duration,
                    r.totalAmount,
                    r.paymentMethod,
                    `"${r.outlet?.name || 'General'}"`,
                    `"${r.staffName || '-'}"`
                ].join(","))
            ].join("\n");

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", `Rental_PS_Export_${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            toast.success("Data dieksport ke CSV");
        } catch (e) {
            toast.error("Gagal mengeksport data");
        } finally {
            setIsExporting(false);
        }
    };

    const handleShareWA = (record: RentalRecord) => {
        const text = `*NOTA DIGITAL LEVEL UP GAMING*\n` +
            `---------------------------\n` +
            `No: ${record.invoiceNumber}\n` +
            `Customer: ${record.customerName}\n` +
            `Unit: ${record.psType}\n` +
            `Durasi: ${record.duration} Jam\n` +
            `Metode: ${record.paymentMethod}\n` +
            `Total: Rp ${record.totalAmount.toLocaleString()}\n` +
            `---------------------------\n` +
            `Terima kasih sudah bermain!\n` +
            `_Sistem by SDM ERP_`;

        const encoded = encodeURIComponent(text);
        window.open(`https://wa.me/?text=${encoded}`, '_blank');
    };

    const printRef = useRef<HTMLIFrameElement>(null);

    const handlePrint = (record: RentalRecord) => {
        const printWindow = printRef.current;
        if (!printWindow) return;

        const content = `
            <html>
                <head>
                    <title>Print Receipt - ${record.invoiceNumber}</title>
                    <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
                    <style>
                        @page { size: auto; margin: 0; }
                        body { background: white; padding: 20px; font-family: monospace; }
                        #ps-receipt { border: none !important; }
                    </style>
                </head>
                <body>
                    <div id="print-area"></div>
                    <script>
                        window.onload = function() {
                            window.print();
                        };
                    </script>
                </body>
            </html>
        `;

        const doc = printWindow.contentDocument || printWindow.contentWindow?.document;
        if (doc) {
            doc.open();
            doc.write(content);
            doc.close();

            const printArea = doc.getElementById('print-area');
            if (printArea) {
                const receiptHtml = document.getElementById('ps-receipt-container')?.innerHTML || '';
                printArea.innerHTML = receiptHtml;
            }
        }
    };

    if (isLoading && stage === 'LIST') return <LoadingState text="Menghubungkan ke Level Up Database..." />;

    return (
        <div className="max-w-6xl mx-auto space-y-6 pb-12 relative no-print">
            <Header
                stage={stage}
                setStage={(s) => {
                    if (s !== 'FORM') setEditingRecord(null);
                    setStage(s);
                }}
                onReset={() => {
                    setSelectedRecord(null);
                    setEditingRecord(null);
                    setCustomerName('');
                    setDuration('1');
                }}
                canAccessSettings={canAccessSettings}
            />

            {(currentUser.role === 'OWNER' || currentUser.role === 'FINANCE') && stage === 'LIST' && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="bg-white p-6 rounded-[2rem] shadow-xl border border-slate-100 relative overflow-hidden group">
                        <div className="absolute -right-4 -top-4 w-20 h-20 bg-blue-50 rounded-full group-hover:scale-110 transition-transform" />
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1 relative">Total Omzet</p>
                        <h4 className="text-xl font-black italic tracking-tighter text-slate-900 relative">Rp {stats.totalRevenue.toLocaleString()}</h4>
                    </div>
                    <div className="bg-white p-6 rounded-[2rem] shadow-xl border border-slate-100 relative overflow-hidden group">
                        <div className="absolute -right-4 -top-4 w-20 h-20 bg-emerald-50 rounded-full group-hover:scale-110 transition-transform" />
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1 relative">Metode Tunai</p>
                        <h4 className="text-xl font-black italic tracking-tighter text-emerald-600 relative">Rp {stats.totalCash.toLocaleString()}</h4>
                    </div>
                    <div className="bg-white p-6 rounded-[2rem] shadow-xl border border-slate-100 relative overflow-hidden group">
                        <div className="absolute -right-4 -top-4 w-20 h-20 bg-amber-50 rounded-full group-hover:scale-110 transition-transform" />
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1 relative">Metode Transfer</p>
                        <h4 className="text-xl font-black italic tracking-tighter text-amber-600 relative">Rp {stats.totalTransfer.toLocaleString()}</h4>
                    </div>
                    <div className="bg-white p-6 rounded-[2rem] shadow-xl border border-slate-100 relative overflow-hidden group">
                        <div className="absolute -right-4 -top-4 w-20 h-20 bg-slate-50 rounded-full group-hover:scale-110 transition-transform" />
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1 relative">Total Transaksi</p>
                        <h4 className="text-xl font-black italic tracking-tighter text-slate-900 relative">{stats.count} Items</h4>
                    </div>
                </div>
            )}

            {stage === 'LIST' && (
                <div className="bg-white px-8 py-6 rounded-[2rem] shadow-xl border border-slate-100 flex flex-col md:flex-row items-center justify-between gap-6 animate-in fade-in duration-500">
                    <div className="flex flex-wrap items-center gap-4">
                        <div className="space-y-1">
                            <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-2">Dari Tanggal</label>
                            <input
                                type="date"
                                value={dateRange.startDate}
                                onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                                className="bg-slate-50 border-none rounded-xl px-4 py-2 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-2">Sampai Tanggal</label>
                            <input
                                type="date"
                                value={dateRange.endDate}
                                onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                                className="bg-slate-50 border-none rounded-xl px-4 py-2 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <button
                            onClick={fetchHistory}
                            disabled={isFiltering}
                            className="mt-5 bg-slate-900 text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all disabled:opacity-50"
                        >
                            {isFiltering ? 'LOADING...' : 'TERAPKAN'}
                        </button>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setIsGuideOpen(true)}
                            className="p-3 bg-slate-50 text-slate-400 rounded-xl hover:bg-slate-900 hover:text-white transition-all shadow-sm"
                            title="Panduan Import"
                        >
                            <Info size={16} />
                        </button>
                        <button
                            onClick={handleImport}
                            disabled={isImporting}
                            className="p-3 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-600 hover:text-white transition-all shadow-sm flex items-center gap-2 group"
                            title="Import Spreadsheet (CSV/JSON)"
                        >
                            <Share size={16} className="rotate-180" />
                            <span className="text-[10px] font-black uppercase tracking-widest hidden group-hover:block">Import</span>
                        </button>
                        <button
                            onClick={handleExport}
                            disabled={isExporting}
                            className="p-3 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-sm flex items-center gap-2 group"
                            title="Export to CSV"
                        >
                            <Download size={16} />
                            <span className="text-[10px] font-black uppercase tracking-widest hidden group-hover:block">Export</span>
                        </button>
                    </div>
                </div>
            )}

            {stage === 'FORM' && (
                <Form
                    customerName={customerName} setCustomerName={setCustomerName}
                    psType={psType} setPsType={setPsType}
                    duration={duration} setDuration={setDuration}
                    paymentMethod={paymentMethod} setPaymentMethod={setPaymentMethod}
                    cashPart={cashPart} setCashPart={setCashPart}
                    transferPart={transferPart} setTransferPart={setTransferPart}
                    calculateTotal={calculateTotal} prices={pricesMap}
                    isSubmitting={isSubmitting} isEditing={!!editingRecord} handleSubmit={handleSubmit}
                    outlets={outlets} selectedOutletId={selectedOutletId} setSelectedOutletId={setSelectedOutletId}
                />
            )}

            {stage === 'LIST' && (
                <History
                    history={history}
                    onSelect={setSelectedRecord}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                />
            )}

            {stage === 'SETTINGS' && canAccessSettings && (
                <Settings
                    prices={rentalPrices}
                    onRefresh={() => fetchPrices(selectedOutletId)}
                    outlets={outlets}
                    onRefreshOutlets={fetchOutlets}
                    selectedOutletId={selectedOutletId}
                    setSelectedOutletId={setSelectedOutletId}
                    currentUser={currentUser}
                />
            )}

            {stage === 'SUCCESS' && lastCreated && !selectedRecord && (
                <div className="flex flex-col items-center justify-center min-h-[500px] animate-in zoom-in duration-500">
                    <div className="bg-white p-12 rounded-[3.5rem] shadow-2xl border border-slate-100 flex flex-col items-center max-w-lg w-full text-center relative overflow-hidden">
                        <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-emerald-400 to-blue-500" />
                        <div className="w-24 h-24 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mb-8 shadow-inner">
                            <CheckCircle2 size={48} />
                        </div>
                        <h2 className="text-3xl font-black uppercase italic tracking-tighter text-slate-900 mb-2">Transaksi Sukses!</h2>
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-8">Data telah diposting ke Finance SDM</p>

                        <div id="ps-receipt-container">
                            <Receipt record={lastCreated} />
                        </div>

                        <div className="flex flex-col gap-3 w-full mt-8">
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => handlePrint(lastCreated)}
                                    className="bg-blue-600 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-blue-700 transition-all"
                                >
                                    <Download size={14} /> CETAK
                                </button>
                                <button
                                    onClick={() => handleShareWA(lastCreated)}
                                    className="bg-emerald-600 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-emerald-700 transition-all"
                                >
                                    <Share2 size={14} /> SHARE WA
                                </button>
                            </div>
                            <button
                                onClick={() => setStage('LIST')}
                                className="w-full bg-slate-100 text-slate-500 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all"
                            >
                                KEMBALI KE RIWAYAT
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {selectedRecord && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setSelectedRecord(null)} />
                    <div className="bg-white rounded-[3rem] w-full max-w-lg relative z-10 overflow-hidden shadow-2xl animate-in zoom-in duration-300">
                        <div className="p-8 flex justify-between items-center border-b border-slate-50">
                            <div>
                                <h3 className="font-black uppercase italic tracking-widest text-slate-800">Detail Transaksi</h3>
                                <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">{selectedRecord.invoiceNumber}</p>
                            </div>
                            <button onClick={() => setSelectedRecord(null)} className="p-3 bg-slate-50 text-slate-400 rounded-2xl hover:bg-red-50 hover:text-red-500 transition-all">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-8 bg-slate-50/50" id="ps-receipt-container">
                            <Receipt record={selectedRecord} />
                        </div>
                        <div className="p-8 grid grid-cols-2 gap-4">
                            <button
                                onClick={() => handlePrint(selectedRecord)}
                                className="bg-blue-600 text-white py-5 rounded-[2rem] font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2"
                            >
                                <Download size={14} /> CETAK ULANG
                            </button>
                            <button
                                onClick={() => handleShareWA(selectedRecord)}
                                className="bg-emerald-600 text-white py-5 rounded-[2rem] font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2"
                            >
                                <Share2 size={14} /> SHARE WA
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isGuideOpen && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md" onClick={() => setIsGuideOpen(false)} />
                    <div className="bg-white rounded-[3rem] w-full max-w-2xl relative z-10 overflow-hidden shadow-2xl animate-in zoom-in duration-300">
                        <div className="p-10 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                            <div className="flex items-center gap-4">
                                <div className="p-4 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-200">
                                    <FileText size={24} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black uppercase italic tracking-tighter text-slate-800">Panduan Import Data</h3>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Migrasi Spreadsheet ke ERP</p>
                                </div>
                            </div>
                            <button onClick={() => setIsGuideOpen(false)} className="p-3 bg-white text-slate-400 rounded-2xl hover:bg-red-50 hover:text-red-500 transition-all shadow-sm">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-10 space-y-8 overflow-y-auto max-h-[60vh]">
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-3">
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-600">Kolom Wajib (CSV/JSON)</h4>
                                    <ul className="space-y-2">
                                        {["date (YYYY-MM-DD)", "customer", "unit (PS 3/4)", "duration (Angka)", "nominal (Uang)", "paymentMethod (CASH/TF)", "petugas"].map(item => (
                                            <li key={item} className="flex items-center gap-2 text-[11px] font-bold text-slate-600">
                                                <div className="w-1.5 h-1.5 bg-blue-400 rounded-full" /> {item}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                                <div className="bg-amber-50 rounded-3xl p-6 border border-amber-100 space-y-3">
                                    <div className="flex items-center gap-2 text-amber-600">
                                        <AlertCircle size={16} />
                                        <h4 className="text-[10px] font-black uppercase tracking-widest">Catatan Penting</h4>
                                    </div>
                                    <p className="text-[10px] leading-relaxed font-bold text-amber-700 uppercase">
                                        Sistem akan otomatis membersihkan titik & koma pada nominal. Data import tidak akan mempengaruhi saldo nyata di Finance Pusat.
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Pratinjau Format CSV</h4>
                                <div className="bg-slate-900 rounded-2xl p-6 overflow-x-auto">
                                    <code className="text-[10px] font-mono text-emerald-400 whitespace-nowrap">
                                        date,customer,unit,duration,nominal,paymentMethod,petugas<br />
                                        2024-01-20,Budi Darmawan,PS 4,2,20.000,CASH,Andri Staff
                                    </code>
                                </div>
                            </div>
                        </div>

                        <div className="p-10 bg-slate-50/80 flex flex-col md:flex-row gap-4">
                            <button
                                onClick={downloadTemplate}
                                className="flex-1 bg-white border-2 border-slate-200 text-slate-600 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:border-blue-500 hover:text-blue-600 transition-all"
                            >
                                <Download size={14} /> UNDUH TEMPLATE CSV
                            </button>
                            <button
                                onClick={() => { setIsGuideOpen(false); handleImport(); }}
                                className="flex-1 bg-slate-900 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl shadow-slate-200 hover:bg-blue-600 transition-all"
                            >
                                <Share size={14} className="rotate-180" /> MULAI IMPORT SEKARANG
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <iframe ref={printRef} style={{ display: 'none' }} title="Receipt Printing" />
        </div>
    );
};

export default RentalPSPortal;
