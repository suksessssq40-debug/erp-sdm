
import React from 'react';
import { RentalRecord } from './types';

interface ReceiptProps {
    record: RentalRecord;
}

export const Receipt: React.FC<ReceiptProps> = ({ record }) => {
    return (
        <div id="ps-receipt" className="bg-white p-8 border border-dashed border-slate-200 text-left w-full mx-auto max-w-sm font-mono text-slate-800">
            <div className="text-center mb-6 space-y-1">
                <h3 className="text-xl font-black uppercase italic tracking-tighter">LEVEL UP GAMING</h3>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">{record.outlet?.name || 'General Outlet'}</p>
                <p className="text-[10px] font-bold text-slate-400">RECEIPT / STRUK RENTAL</p>
                <div className="border-b border-black/10 pt-2" />
            </div>

            <div className="space-y-3 text-[12px]">
                <div className="flex justify-between">
                    <span className="text-slate-400 uppercase">Nota:</span>
                    <span className="font-bold">{record.invoiceNumber}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-slate-400 uppercase">Tgl:</span>
                    <span className="font-bold">{new Date(record.createdAt).toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between border-b border-black/5 pb-2">
                    <span className="text-slate-400 uppercase">Customer:</span>
                    <span className="font-bold truncate max-w-[150px]">{record.customerName}</span>
                </div>

                <div className="pt-2">
                    <div className="flex justify-between font-bold">
                        <span>{record.psType} ({record.duration} JAM)</span>
                        <span>Rp {record.totalAmount.toLocaleString()}</span>
                    </div>
                </div>


                <div className="border-t border-black/10 pt-2 mt-4 space-y-2">
                    <div className="flex justify-between items-center">
                        <span className="text-slate-400 uppercase">Total:</span>
                        <span className="text-xl font-black italic">Rp {record.totalAmount.toLocaleString()}</span>
                    </div>

                    <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-slate-400">
                            <span>Metode Bayar:</span>
                            <span className="font-bold text-slate-600">{record.paymentMethod}</span>
                        </div>

                        {record.paymentMethod === 'SPLIT' && (
                            <div className="bg-slate-50 p-2 rounded-lg space-y-1 mt-2">
                                <div className="flex justify-between text-[10px]">
                                    <span className="text-slate-400">Cash:</span>
                                    <span className="font-bold">Rp {record.cashAmount.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-[10px]">
                                    <span className="text-slate-400">Transfer:</span>
                                    <span className="font-bold">Rp {record.transferAmount.toLocaleString()}</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

            </div>

            <div className="text-center mt-10 space-y-1">
                <p className="text-[10px] font-bold italic">Terima kasih atas kunjungannya!</p>
                <p className="text-[8px] text-slate-300">Printed via SDM ERP - Level Up Portal</p>
            </div>
        </div>
    );
};
