
import React from 'react';
import { Attendance, User } from '@/types';
import { History, CalendarX2 } from 'lucide-react';
import { EmptyState } from '../EmptyState';

interface AttendanceHistoryProps {
    attendanceLog: Attendance[];
    currentUserId: string;
    todayISO: string;
}

export const AttendanceHistory: React.FC<AttendanceHistoryProps> = ({ attendanceLog, currentUserId, todayISO }) => {
    const myTodayLogs = attendanceLog
        .filter(a => a.userId === currentUserId && a.date === todayISO)
        .sort((a, b) => {
            const timeA = a.timeIn || '';
            const timeB = b.timeIn || '';
            return timeB.localeCompare(timeA);
        });

    return (
        <div className="bg-white p-8 rounded-[3rem] shadow-xl border border-slate-100 h-full overflow-hidden flex flex-col">
            <h4 className="font-black text-slate-800 mb-6 flex items-center uppercase tracking-widest text-xs shrink-0">
                <History className="mr-3 text-blue-500" size={18} />
                RIWAYAT HARI INI
            </h4>
            <div className="space-y-4 overflow-y-auto custom-scrollbar flex-1 pr-2">
                {myTodayLogs.length === 0 ? (
                    <EmptyState
                        icon={CalendarX2}
                        title="Belum Ada Riwayat"
                        description="Anda belum melakukan absensi masuk hari ini. Yuk check-in!"
                    />
                ) : (
                    myTodayLogs.map(a => (
                        <div key={a.id} className="p-5 bg-slate-50 rounded-2xl flex flex-col gap-3 group hover:bg-white hover:shadow-md transition border border-slate-100">
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${a.isLate ? 'bg-rose-500' : 'bg-emerald-500'}`}></div>
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">AKTIVITAS HARI INI</p>
                                </div>
                                {a.isLate ? (
                                    <span className="bg-rose-100 text-rose-600 text-[8px] font-black px-2 py-1 rounded-lg uppercase tracking-widest border border-rose-200">Terlambat</span>
                                ) : (
                                    <span className="bg-emerald-100 text-emerald-600 text-[8px] font-black px-2 py-1 rounded-lg uppercase tracking-widest border border-emerald-200">On Time</span>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-1">JAM MASUK</p>
                                    <p className="text-xl font-black text-slate-800 tracking-tight">{a.timeIn}</p>
                                </div>
                                {a.timeOut && (
                                    <div className="text-right">
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-1">JAM PULANG</p>
                                        <p className="text-xl font-black text-slate-800 tracking-tight">{a.timeOut}</p>
                                    </div>
                                )}
                            </div>

                            {a.lateReason && (
                                <div className="p-3 bg-rose-50/50 rounded-xl border border-rose-100/50">
                                    <p className="text-[8px] font-black text-rose-400 uppercase tracking-widest mb-1">ALASAN TERLAMBAT</p>
                                    <p className="text-[10px] font-medium text-rose-700 italic">"{a.lateReason}"</p>
                                </div>
                            )}

                            {a.shiftId && (
                                <div className="flex items-center gap-1.5 mt-1">
                                    <span className="w-1.5 h-1.5 bg-purple-400 rounded-full"></span>
                                    <span className="text-[9px] font-black text-purple-500 uppercase tracking-widest">SHIFT MODE ACTIVE</span>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
