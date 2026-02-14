
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
import { FinancialCharts } from './FinancialCharts';
import {
    CheckCircle2, Download, Share2, X, Share, Info, FileText, AlertCircle,
    Calendar as CalendarIcon, Filter, FileSpreadsheet, FileDown, ChevronDown, TrendingUp
} from 'lucide-react';

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
    const [trendData, setTrendData] = useState<any[]>([]);
    const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
    const [searchQuery, setSearchQuery] = useState('');
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [isFiltering, setIsFiltering] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [isGuideOpen, setIsGuideOpen] = useState(false);
    const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);
    const exportRef = useRef<HTMLDivElement>(null);

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

    const fetchHistory = async (isLoadMore = false) => {
        if (isLoadMore) setIsLoadingMore(true);
        else setIsFiltering(true);

        try {
            const token = localStorage.getItem('sdm_erp_auth_token');
            const currentPage = isLoadMore ? page + 1 : 1;

            const params = new URLSearchParams({
                limit: '20',
                page: String(currentPage),
                trend: 'true'
            });

            if (dateRange.startDate) params.append('startDate', dateRange.startDate);
            if (dateRange.endDate) params.append('endDate', dateRange.endDate);
            if (selectedOutletId) params.append('outletId', selectedOutletId);
            if (searchQuery) params.append('search', searchQuery);

            const res = await fetch(`/api/rental-ps?${params.toString()}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                const data = await res.json();
                if (isLoadMore) {
                    setHistory(prev => [...prev, ...data.records]);
                    setPage(currentPage);
                } else {
                    setHistory(data.records);
                    setTrendData(data.trend || []);
                    setPage(1);
                }
                setStats(data.stats);
                setHasMore(data.records.length === 20 && (data.stats.totalCount > (isLoadMore ? history.length + 20 : 20)));
            }
        } catch (e) {
            toast.error("Gagal mengambil riwayat rental");
        } finally {
            setIsFiltering(false);
            setIsLoadingMore(false);
            setIsLoading(false);
        }
    };

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            if (isLoading) return;
            fetchHistory();
        }, 500);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    const handlePresetDate = (type: 'TODAY' | 'WEEK' | 'MONTH') => {
        const now = new Date();
        let start = new Date();
        if (type === 'WEEK') start.setDate(now.getDate() - 7);
        if (type === 'MONTH') {
            start = new Date(now.getFullYear(), now.getMonth(), 1);
        }

        setDateRange({
            startDate: start.toISOString().split('T')[0],
            endDate: now.toISOString().split('T')[0]
        });
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
        // Click outside handler for export dropdown
        const handleClickOutside = (event: MouseEvent) => {
            if (exportRef.current && !exportRef.current.contains(event.target as Node)) {
                setIsExportDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
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
                        // CRITICAL: cellDates:false to get raw serial numbers and avoid XLSX timezone bugs
                        const { read, utils } = await import('xlsx');
                        const workbook = read(data, {
                            type: 'binary',
                            cellDates: false,  // FALSE! We handle conversion manually for accuracy
                            cellNF: false,
                            cellText: false
                        });
                        const sheetName = workbook.SheetNames[0];
                        const worksheet = workbook.Sheets[sheetName];
                        const rawRecords = utils.sheet_to_json(worksheet);

                        // ROBUST Excel Date Converter - Handles serial numbers correctly
                        const excelToJSDate = (serial: any) => {
                            if (!serial) return null;

                            // If somehow still a Date object, return as-is
                            if (serial instanceof Date) {
                                return serial;
                            }

                            if (typeof serial === 'number') {
                                // Excel serial date system:
                                // Serial 1 = January 1, 1900
                                // Serial 2 = January 2, 1900
                                // etc.

                                // Excel has a bug: treats 1900 as a leap year (it wasn't)
                                // Serial 60 = February 29, 1900 (which didn't exist)
                                // For serials > 60, we need to subtract 1 day

                                let adjustedSerial = serial;

                                // Correct for Excel's 1900 leap year bug
                                if (serial > 60) {
                                    adjustedSerial = serial - 1;
                                }

                                // Excel epoch: January 1, 1900 is serial 1
                                // So serial 0 would be December 31, 1899
                                // We calculate from January 1, 1900 and subtract 1 from adjusted serial
                                const jan1_1900 = Date.UTC(1900, 0, 1, 0, 0, 0, 0);
                                const msPerDay = 86400000;
                                const dateUTC = new Date(jan1_1900 + ((adjustedSerial - 1) * msPerDay));

                                return dateUTC;
                            }

                            // Try parsing as string
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

                            // BULLETPROOF DATE: Extract YYYY-MM-DD from Excel Date object
                            // CRITICAL: XLSX library returns Date objects in UTC, so we MUST use getUTC* methods!
                            // Using getFullYear/getMonth/getDate would apply local timezone offset and shift the date
                            let dateStr = null;
                            if (date) {
                                const y = date.getUTCFullYear();
                                const m = (date.getUTCMonth() + 1).toString().padStart(2, '0');
                                const d = date.getUTCDate().toString().padStart(2, '0');
                                dateStr = `${y}-${m}-${d}`;
                            }

                            return {
                                date: dateStr,
                                customer: findVal(['customer', 'pelanggan', 'nama']),
                                unit: findVal(['unit', 'ps']),
                                duration: findVal(['durasi', 'duration', 'jam']),
                                cashAmount: findVal(['tunai', 'cash']),
                                transferAmount: findVal(['transfer', 'bank', 'tf']),
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

    const exportToPDF = async () => {
        if (history.length === 0) return toast.error("Tidak ada data untuk dieksport");
        setIsExporting(true);

        try {
            // Dynamic import to avoid SSR/Build issues
            const { jsPDF } = await import('jspdf');
            const autoTable = (await import('jspdf-autotable')).default;

            const generatePDF = () => {
                const doc = new jsPDF();
                const pageWidth = doc.internal.pageSize.getWidth();
                const pageHeight = doc.internal.pageSize.getHeight();
                const margin = 15;

                // 1. HEADER (Vector)
                doc.setFillColor(15, 23, 42); // slate-900
                doc.rect(0, 0, pageWidth, 40, 'F');

                doc.setTextColor(255, 255, 255);
                doc.setFontSize(22);
                doc.setFont('helvetica', 'bold');
                doc.text("LEVEL UP GAMING", margin, 20);

                doc.setFontSize(8);
                doc.setFont('helvetica', 'normal');
                doc.text("LAPORAN RENTAL PLAYSTATION - DIGITAL REPORT", margin, 28);
                doc.text(`PERIODE: ${dateRange.startDate || 'Semua'} s/d ${dateRange.endDate || 'Sekarang'}`, margin, 33);

                let currentY = 55;

                // 2. STATS CARDS (Vector Drawing for Sharpness)
                const cardWidth = (pageWidth - (margin * 2) - 10) / 3;
                const cardHeight = 25;

                // Helper to draw card
                const drawCard = (x: number, title: string, value: string, sub: string, color: [number, number, number]) => {
                    // Card Bg
                    doc.setFillColor(248, 250, 252); // slate-50
                    doc.setDrawColor(226, 232, 240); // slate-200
                    doc.roundedRect(x, currentY, cardWidth, cardHeight, 3, 3, 'FD');

                    // Accent Line
                    doc.setDrawColor(color[0], color[1], color[2]);
                    doc.setLineWidth(1);
                    doc.line(x + 5, currentY + 5, x + 5, currentY + cardHeight - 5);

                    // Title
                    doc.setTextColor(100, 116, 139); // slate-400
                    doc.setFontSize(7);
                    doc.setFont('helvetica', 'bold');
                    doc.text(title, x + 10, currentY + 8);

                    // Value
                    doc.setTextColor(15, 23, 42); // slate-900
                    doc.setFontSize(11);
                    doc.text(value, x + 10, currentY + 18);

                    // Subtext (Right aligned)
                    doc.setFontSize(6);
                    doc.setTextColor(color[0], color[1], color[2]);
                    doc.text(sub, x + cardWidth - 5, currentY + 18, { align: 'right' });
                };

                drawCard(margin, "PENDAPATAN", `Rp ${stats.totalRevenue.toLocaleString()}`, `${stats.count} Sesi`, [59, 130, 246]); // Blue
                drawCard(margin + cardWidth + 5, "TUNAI (CASH)", `Rp ${stats.totalCash.toLocaleString()}`, `${Math.round((stats.totalCash / (stats.totalRevenue || 1)) * 100)}%`, [16, 185, 129]); // Emerald
                drawCard(margin + (cardWidth * 2) + 10, "TRANSFER", `Rp ${stats.totalTransfer.toLocaleString()}`, "Transfer", [99, 102, 241]); // Indigo

                currentY += 35;

                // 3. MINI TREND CHART (Vector Line Graph)
                if (trendData && trendData.length > 1) {
                    const chartHeight = 40;
                    const chartWidth = pageWidth - (margin * 2);

                    // Chart Config
                    doc.setDrawColor(203, 213, 225); // slate-300 axis
                    doc.setLineWidth(0.1);
                    doc.line(margin, currentY + chartHeight, margin + chartWidth, currentY + chartHeight); // X-Axis
                    doc.line(margin, currentY, margin, currentY + chartHeight); // Y-Axis

                    doc.setFontSize(7);
                    doc.setTextColor(100, 116, 139);
                    doc.text("GRAFIK TREND HARIAN", margin, currentY - 3);

                    // Calculate Points
                    const maxVal = Math.max(...trendData.map(d => d.value)) || 1;
                    const points: { x: number, y: number }[] = trendData.map((d, i) => {
                        const x = margin + (i * (chartWidth / (trendData.length - 1)));
                        const y = (currentY + chartHeight) - ((d.value / maxVal) * (chartHeight - 5)); // -5 padding top
                        return { x, y };
                    });

                    // Draw Line
                    doc.setDrawColor(59, 130, 246); // Blue-500
                    doc.setLineWidth(0.5);
                    for (let i = 0; i < points.length - 1; i++) {
                        doc.line(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y);
                    }

                    // Draw Dots
                    doc.setFillColor(59, 130, 246);
                    points.forEach(p => doc.circle(p.x, p.y, 0.8, 'F'));

                    currentY += chartHeight + 10;
                }

                // 4. DATA TABLE
                autoTable(doc, {
                    startY: currentY,
                    head: [["No", "Nota", "Customer", "Unit", "Durasi", "Total", "Metode", "Outlet"]],
                    body: history.map((r, i) => [
                        i + 1,
                        r.invoiceNumber,
                        r.customerName,
                        r.psType,
                        `${r.duration} Jam`,
                        `Rp ${r.totalAmount.toLocaleString()}`,
                        r.paymentMethod,
                        r.outlet?.name || 'General'
                    ]),
                    theme: 'striped',
                    headStyles: { fillColor: [15, 23, 42], fontSize: 8, fontStyle: 'bold', halign: 'center' },
                    bodyStyles: { fontSize: 7, textColor: [51, 65, 85] },
                    columnStyles: {
                        0: { halign: 'center', cellWidth: 10 },
                        4: { halign: 'center' },
                        5: { halign: 'right', fontStyle: 'bold' },
                        6: { halign: 'center' }
                    },
                    didDrawPage: (data) => {
                        doc.setFontSize(6);
                        doc.setTextColor(150);
                        doc.text(`Halaman ${data.pageNumber} | Dicetak: ${new Date().toLocaleString()}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
                    }
                });

                doc.save(`Laporan_Rental_LevelUp_${new Date().toISOString().split('T')[0]}.pdf`);
            };

            const toastId = toast.loading("Memproses PDF Vektor...");
            try {
                // Add a small delay to allow UI to render toast
                await new Promise(resolve => setTimeout(resolve, 500));

                generatePDF();

                toast.dismiss(toastId);
                toast.success("Laporan PDF Siap!");
            } catch (error) {
                console.error(error);
                toast.dismiss(toastId);
                toast.error("Gagal membuat PDF");
            }

        } catch (e) {
            console.error(e);
            toast.error("Gagal inisialisasi PDF Engine");
        } finally {
            setIsExporting(false);
            setIsExportDropdownOpen(false);
        }
    };

    const exportToExcel = async () => {
        if (history.length === 0) return toast.error("Tidak ada data untuk dieksport");
        setIsExporting(true);

        try {
            const ExcelJS = (await import('exceljs')).default;
            const workbook = new ExcelJS.Workbook();
            const sheet = workbook.addWorksheet('Dashboard & Data', { views: [{ showGridLines: false }] });

            // 1. DASHBOARD SECTION (Rows 1-6)
            // Title
            sheet.mergeCells('B2:E2');
            const titleCell = sheet.getCell('B2');
            titleCell.value = 'LEVEL UP GAMING - RENTAL REPORT';
            titleCell.font = { name: 'Arial Black', size: 16, color: { argb: 'FF1E293B' } }; // Slate 800

            sheet.mergeCells('B3:E3');
            const subtitleCell = sheet.getCell('B3');
            subtitleCell.value = `Periode: ${dateRange.startDate || 'Semua'} s/d ${dateRange.endDate || 'Sekarang'}`;
            subtitleCell.font = { name: 'Arial', size: 10, color: { argb: 'FF64748B' }, italic: true }; // Slate 500

            // Summary Cards Logic
            const addCard = (colStart: string, label: string, value: string, bgColor: string, textColor: string) => {
                sheet.mergeCells(`${colStart}5:${String.fromCharCode(colStart.charCodeAt(0) + 1)}5`); // Badge
                sheet.mergeCells(`${colStart}6:${String.fromCharCode(colStart.charCodeAt(0) + 1)}6`); // Value

                const labelCell = sheet.getCell(`${colStart}5`);
                labelCell.value = label;
                labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
                labelCell.font = { name: 'Arial', size: 9, bold: true, color: { argb: textColor } };
                labelCell.alignment = { horizontal: 'center', vertical: 'middle' };

                const valueCell = sheet.getCell(`${colStart}6`);
                valueCell.value = value;
                valueCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
                valueCell.font = { name: 'Arial Black', size: 12, color: { argb: 'FF0F172A' } };
                valueCell.alignment = { horizontal: 'center', vertical: 'middle' };
                valueCell.border = { bottom: { style: 'thick', color: { argb: bgColor } } };
            };

            addCard('B', 'TOTAL PENDAPATAN', `Rp ${stats.totalRevenue.toLocaleString()}`, 'FF3B82F6', 'FFFFFFFF'); // Blue
            addCard('E', 'TOTAL SESI', `${stats.count} Transaksi`, 'FF10B981', 'FFFFFFFF'); // Emerald
            addCard('H', 'CASH RATIO', `${Math.round((stats.totalCash / (stats.totalRevenue || 1)) * 100)}%`, 'FF64748B', 'FFFFFFFF'); // Slate

            // 2. DATA TABLE SECTION (Row 9+)
            const tableStartRow = 9;

            // Define columns manually first to set width
            sheet.getColumn('A').width = 5;  // Spacing
            sheet.getColumn('B').width = 5;  // No
            sheet.getColumn('C').width = 18; // Invoice
            sheet.getColumn('D').width = 20; // Date
            sheet.getColumn('E').width = 25; // Customer
            sheet.getColumn('F').width = 12; // Unit
            sheet.getColumn('G').width = 12; // Duration
            sheet.getColumn('H').width = 18; // Total (With Bars)
            sheet.getColumn('I').width = 12; // Method
            sheet.getColumn('J').width = 20; // Outlet

            // Table Headers
            const headerRow = sheet.getRow(tableStartRow);
            const headers = ['NO', 'INVOICE', 'TANGGAL', 'CUSTOMER', 'UNIT', 'DURASI', 'TOTAL', 'METODE', 'OUTLET'];
            headers.forEach((h, i) => {
                const cell = headerRow.getCell(i + 2); // Start from col B
                cell.value = h;
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }; // Slate 900
                cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
                cell.alignment = { horizontal: 'center' };
            });

            // Data Rows
            history.forEach((r, i) => {
                const row = sheet.getRow(tableStartRow + i + 1);
                row.getCell(2).value = i + 1;
                row.getCell(3).value = r.invoiceNumber;
                row.getCell(4).value = new Date(r.createdAt).toLocaleString();
                row.getCell(5).value = r.customerName;
                row.getCell(6).value = r.psType;
                row.getCell(7).value = r.duration;
                row.getCell(8).value = r.totalAmount;
                row.getCell(9).value = r.paymentMethod;
                row.getCell(10).value = r.outlet?.name || 'General';

                // Styling
                row.eachCell((cell) => {
                    cell.border = { bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } } };
                    cell.alignment = { vertical: 'middle' };
                });

                // Specific alignment
                row.getCell(2).alignment = { horizontal: 'center' }; // No
                row.getCell(6).alignment = { horizontal: 'center' }; // Unit
                row.getCell(7).alignment = { horizontal: 'center' }; // Duration
                row.getCell(8).alignment = { horizontal: 'right' };  // Total
                row.getCell(8).numFmt = '#,##0'; // Currency formatting
            });

            // 3. VISUALIZATION (Data Bars for Total Column)
            // Add conditional formatting for Data Bars on Column H (Total)
            const totalRange = `H${tableStartRow + 1}:H${tableStartRow + history.length}`;
            sheet.addConditionalFormatting({
                ref: totalRange,
                rules: [
                    {
                        type: 'dataBar',
                        priority: 1,
                        gradient: true,
                        showValue: true,
                        cfvo: [{ type: 'min', value: 0 }, { type: 'max', value: 0 }]
                    }
                ]
            });

            // Freeze panes for scrolling
            sheet.views = [{ state: 'frozen', ySplit: tableStartRow, showGridLines: false }];

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = `Laporan_Visual_Rental_${new Date().toISOString().split('T')[0]}.xlsx`;
            link.click();

            toast.success("Excel Visual Berhasil Diunduh");
        } catch (e) {
            console.error(e);
            toast.error("Gagal membuat Excel: " + (e as any).message);
        } finally {
            setIsExporting(false);
            setIsExportDropdownOpen(false);
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

            {stage === 'LIST' && (
                <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-top-4 duration-500">
                    {/* CONTROL CENTER: One row for everything */}
                    <div className="bg-white p-4 md:p-6 rounded-[2rem] md:rounded-[2.5rem] shadow-xl border border-slate-100 flex flex-col xl:flex-row xl:items-center justify-between gap-4 md:gap-6">
                        {/* LEFT: Outlet & Presets */}
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                            <div className="relative group flex-1 sm:flex-none">
                                <select
                                    value={selectedOutletId}
                                    onChange={(e) => setSelectedOutletId(e.target.value)}
                                    className="w-full appearance-none bg-slate-50 pl-6 pr-12 py-3 rounded-2xl text-[10px] md:text-[11px] font-black uppercase tracking-widest border-none shadow-inner focus:ring-2 focus:ring-blue-500 cursor-pointer"
                                >
                                    <option value="">🏢 SEMUA OUTLET</option>
                                    {outlets.map(o => (
                                        <option key={o.id} value={o.id}>{o.name}</option>
                                    ))}
                                </select>
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                    <Filter size={14} />
                                </div>
                            </div>

                            <div className="flex bg-slate-50 p-1 rounded-2xl shadow-inner gap-0.5 overflow-x-auto scrollbar-hide">
                                <button onClick={() => handlePresetDate('TODAY')} className="px-3 md:px-4 py-2 hover:bg-white hover:shadow-sm text-[8px] md:text-[9px] font-black uppercase rounded-xl transition-all border-none italic text-slate-500 hover:text-blue-600 whitespace-nowrap">HARI INI</button>
                                <button onClick={() => handlePresetDate('WEEK')} className="px-3 md:px-4 py-2 hover:bg-white hover:shadow-sm text-[8px] md:text-[9px] font-black uppercase rounded-xl transition-all border-none italic text-slate-500 hover:text-blue-600 whitespace-nowrap">7 KEBELAKANG</button>
                                <button onClick={() => handlePresetDate('MONTH')} className="px-3 md:px-4 py-2 hover:bg-white hover:shadow-sm text-[8px] md:text-[9px] font-black uppercase rounded-xl transition-all border-none italic text-slate-500 hover:text-blue-600 whitespace-nowrap">BULAN INI</button>
                            </div>
                        </div>

                        {/* RIGHT CONTENT: Date Range & Action Buttons */}
                        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4">
                            {/* Manual Date Filter */}
                            <div className="flex flex-1 items-center gap-2 md:gap-3 bg-slate-50 px-4 md:px-5 py-2.5 md:py-3 rounded-2xl shadow-inner border-none overflow-x-auto scrollbar-hide">
                                <CalendarIcon size={14} className="text-slate-400 shrink-0" />
                                <input
                                    type="date"
                                    value={dateRange.startDate}
                                    onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                                    className="bg-transparent border-none text-[10px] font-black focus:ring-0 p-0 text-slate-600 min-w-[90px]"
                                />
                                <span className="text-slate-300 font-bold text-[10px]">TO</span>
                                <input
                                    type="date"
                                    value={dateRange.endDate}
                                    onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                                    className="bg-transparent border-none text-[10px] font-black focus:ring-0 p-0 text-slate-600 min-w-[90px]"
                                />
                                <button
                                    onClick={() => fetchHistory()}
                                    disabled={isFiltering}
                                    className="ml-auto p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-md shadow-blue-200 disabled:opacity-50 shrink-0"
                                    title="Terapkan Filter"
                                >
                                    <Filter size={14} />
                                </button>
                            </div>

                            {/* Secondary Actions */}
                            <div className="flex items-center gap-2 justify-end">
                                <button
                                    onClick={() => setIsGuideOpen(true)}
                                    className="p-3 bg-slate-50 text-slate-400 rounded-2xl hover:bg-slate-900 hover:text-white transition-all shadow-sm"
                                    title="Bantuan & Panduan"
                                >
                                    <Info size={18} />
                                </button>
                                <button
                                    onClick={handleImport}
                                    disabled={isImporting}
                                    className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl hover:bg-emerald-600 hover:text-white transition-all shadow-sm flex items-center gap-2 group"
                                    title="Import Data (Excel)"
                                >
                                    <Share size={18} className="rotate-180" />
                                    <span className="text-[10px] font-black uppercase tracking-widest hidden sm:block">Import</span>
                                </button>
                                <div className="relative" ref={exportRef}>
                                    <button
                                        onClick={() => setIsExportDropdownOpen(!isExportDropdownOpen)}
                                        disabled={isExporting}
                                        className={`p-3 rounded-2xl transition-all shadow-sm flex items-center gap-2 group ${isExportDropdownOpen ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-200'}`}
                                        title="Export Data"
                                    >
                                        <Share size={18} />
                                        <span className="text-[10px] font-black uppercase tracking-widest hidden sm:block">Export</span>
                                        <ChevronDown size={14} className={`transition-transform duration-300 ${isExportDropdownOpen ? 'rotate-180' : ''}`} />
                                    </button>

                                    {isExportDropdownOpen && (
                                        <div className="absolute right-0 bottom-full mb-3 w-56 bg-white rounded-[2rem] shadow-2xl border border-slate-100 p-2 z-[60] animate-in slide-in-from-bottom-2 duration-300 origin-bottom-right">
                                            <button
                                                onClick={exportToPDF}
                                                className="w-full flex items-center gap-3 p-4 hover:bg-slate-50 text-slate-700 rounded-xl transition-all group"
                                            >
                                                <div className="p-2 bg-red-100 text-red-500 rounded-lg group-hover:bg-red-500 group-hover:text-white transition-all">
                                                    <FileDown size={16} />
                                                </div>
                                                <div className="text-left">
                                                    <p className="text-[10px] font-black uppercase italic">Laporan PDF</p>
                                                    <p className="text-[8px] font-bold text-slate-400">Formal & Visual</p>
                                                </div>
                                            </button>
                                            <button
                                                onClick={exportToExcel}
                                                className="w-full flex items-center gap-3 p-4 hover:bg-slate-50 text-slate-700 rounded-xl transition-all group"
                                            >
                                                <div className="p-2 bg-emerald-100 text-emerald-500 rounded-lg group-hover:bg-emerald-500 group-hover:text-white transition-all">
                                                    <FileSpreadsheet size={16} />
                                                </div>
                                                <div className="text-left">
                                                    <p className="text-[10px] font-black uppercase italic">Dokumen Excel</p>
                                                    <p className="text-[8px] font-bold text-slate-400">Data Analytics</p>
                                                </div>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* VISUAL DASHBOARD (Charts) */}
            {stage === 'LIST' && ['OWNER', 'FINANCE'].includes(currentUser.role) && trendData.length > 0 && (
                <div className="mb-10">
                    <FinancialCharts trendData={trendData} stats={stats} />
                </div>
            )}

            {stage === 'LIST' && (
                <div className="mt-8">
                    <History
                        history={history}
                        onSelect={setSelectedRecord}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        searchQuery={searchQuery}
                        onSearchChange={setSearchQuery}
                        onLoadMore={() => fetchHistory(true)}
                        hasMore={hasMore}
                        isLoadingMore={isLoadingMore}
                    />
                </div>
            )}

            {stage === 'FORM' && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl mx-auto">
                    <Form
                        outlets={outlets}
                        prices={pricesMap}
                        selectedOutletId={selectedOutletId}
                        setSelectedOutletId={setSelectedOutletId}
                        customerName={customerName}
                        setCustomerName={setCustomerName}
                        psType={psType}
                        setPsType={setPsType}
                        duration={duration}
                        setDuration={setDuration}
                        paymentMethod={paymentMethod}
                        setPaymentMethod={setPaymentMethod}
                        cashPart={cashPart}
                        setCashPart={setCashPart}
                        transferPart={transferPart}
                        setTransferPart={setTransferPart}
                        calculateTotal={calculateTotal}
                        isSubmitting={isSubmitting}
                        handleSubmit={handleSubmit}
                        isEditing={!!editingRecord}
                    />
                </div>
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
