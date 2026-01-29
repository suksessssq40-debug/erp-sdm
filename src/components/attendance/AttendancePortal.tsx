
import React from 'react';
import { User, Tenant, Shift, AppSettings } from '@/types';
import { Clock, MapPin, CheckCircle2, LogOut, Loader2, History, Shield } from 'lucide-react';

interface AttendancePortalProps {
    timeString: string;
    dateString: string;
    currentUser: User;
    currentTenant: Tenant | null;
    strategy: string;
    radiusLimit: number;
    currentDistance: number | null;
    gpsAccuracy: number | null;
    gpsLoading: boolean;
    selectedShiftId: string;
    setSelectedShiftId: (id: string) => void;
    shifts: Shift[];
    myAttendanceToday: any;
    handleStartCheckIn: () => void;
    handleStartCheckOut: () => void;
    onViewReport: () => void;
}

export const AttendancePortal: React.FC<AttendancePortalProps> = ({
    timeString, dateString, currentUser, currentTenant, strategy, radiusLimit,
    currentDistance, gpsAccuracy, gpsLoading, selectedShiftId, setSelectedShiftId,
    shifts, myAttendanceToday, handleStartCheckIn, handleStartCheckOut, onViewReport
}) => {
    const isWithinRadius = (currentDistance || 9999) <= radiusLimit;

    return (
        <div className="bg-white p-10 rounded-[3rem] shadow-xl border border-slate-100 flex flex-col items-center justify-center text-center space-y-8 min-h-[500px] relative overflow-hidden h-full">
            {/* Background Decorative Element */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-slate-50/50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 -z-10" />

            <div className="flex flex-col items-center animate-in fade-in zoom-in duration-500">
                <div className="bg-slate-50 border border-slate-100 px-6 py-3 rounded-2xl flex items-center gap-4 mb-6 shadow-sm">
                    <div className="text-right">
                        <p className="text-2xl font-black text-slate-800 leading-none tracking-tight">{timeString}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{dateString}</p>
                    </div>
                    <div className="h-8 w-[1px] bg-slate-200"></div>
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold uppercase text-xs overflow-hidden border border-blue-200">
                            {currentUser.avatarUrl ? (
                                <img src={currentUser.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                            ) : (
                                (currentUser?.name || currentUser?.username || '?').charAt(0)
                            )}
                        </div>
                    </div>
                </div>

                <div className="w-24 h-24 bg-blue-100 rounded-[2rem] flex items-center justify-center text-blue-600 shadow-lg shadow-blue-50 mb-2 relative overflow-hidden group">
                    <Clock size={48} className="group-hover:scale-110 transition-transform duration-500" />
                    <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                </div>
            </div>

            <div className="space-y-4 w-full relative z-10">
                <h3 className="text-3xl font-black text-slate-800 tracking-tight text-center italic uppercase">Portal Absensi</h3>

                <div className="flex justify-center gap-3">
                    <span className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border shadow-sm ${strategy === 'FIXED' ? 'bg-blue-50 border-blue-200 text-blue-600' :
                            strategy === 'SHIFT' ? 'bg-purple-50 border-purple-200 text-purple-600' :
                                'bg-amber-50 border-amber-200 text-amber-600'
                        }`}>
                        <Shield size={10} className="inline mr-1.5" /> STRATEGY: {strategy}
                    </span>
                    <span className="px-4 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-500 text-[9px] font-black uppercase tracking-widest shadow-sm">
                        GEOFENCE: {radiusLimit}M
                    </span>
                </div>

                {strategy === 'SHIFT' && !myAttendanceToday && (
                    <div className="max-w-xs mx-auto w-full space-y-2 pt-2 animate-in slide-in-from-top-2 duration-300">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">TUGAS SHIFT HARI INI</p>
                        <select
                            value={selectedShiftId}
                            onChange={(e) => setSelectedShiftId(e.target.value)}
                            className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold focus:border-purple-500 focus:bg-white outline-none transition cursor-pointer shadow-inner"
                        >
                            <option value="">-- PILIH JADWAL SHIFT --</option>
                            {shifts.map(s => (
                                <option key={s.id} value={s.id}>{s.name.toUpperCase()} ({s.startTime} - {s.endTime})</option>
                            ))}
                        </select>
                    </div>
                )}

                {/* LIVE GPS INDICATOR */}
                {!myAttendanceToday && (
                    <div className={`p-4 rounded-3xl flex items-center justify-between border shadow-sm transition-all duration-500 max-w-sm mx-auto
            ${gpsLoading ? 'bg-slate-50 border-slate-200 animate-pulse' :
                            isWithinRadius ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700'}
          `}>
                        <div className="flex items-center gap-4">
                            <div className={`w-3.5 h-3.5 rounded-full ${gpsLoading ? 'bg-slate-400 animate-pulse' : isWithinRadius ? 'bg-emerald-500' : 'bg-rose-500'} shadow-md`}></div>
                            <div className="text-left">
                                <p className="text-[9px] font-black uppercase tracking-[0.2em] opacity-60">GEOLOCATION STATUS</p>
                                <p className="text-xs font-black uppercase tracking-tighter">
                                    {gpsLoading ? 'SYNCING GPS...' :
                                        isWithinRadius ? `DALAM RADIUS (${Math.round(currentDistance!)}m)` : `DILUAR RADIUS (${Math.round(currentDistance!)}m)`}
                                </p>
                            </div>
                        </div>
                        {!gpsLoading && (
                            <div className="text-right border-l border-current/10 pl-4">
                                <p className="text-[8px] font-bold opacity-40 uppercase tracking-widest">ACCURACY</p>
                                <p className="text-[10px] font-mono font-black">{Math.round(gpsAccuracy || 0)}m</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* REPORT BUTTON (Corner Desktop, Full Mobile) */}
            <button
                onClick={onViewReport}
                className="md:absolute md:top-8 md:right-8 w-full md:w-auto bg-white border border-slate-200 text-slate-600 px-6 py-4 rounded-2xl flex items-center justify-center space-x-2 text-[10px] font-black uppercase tracking-widest hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 transition-all shadow-sm active:scale-95 shrink-0"
            >
                <History size={14} /> <span>LAPORAN LOG</span>
            </button>


            {!myAttendanceToday ? (
                <button
                    onClick={handleStartCheckIn}
                    disabled={gpsLoading || (!currentUser.isFreelance && !isWithinRadius)}
                    className={`px-16 py-6 rounded-[2.5rem] font-black text-xs uppercase tracking-[0.2em] shadow-2xl transition-all transform active:scale-95 flex items-center gap-4
            ${gpsLoading || (!currentUser.isFreelance && !isWithinRadius)
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none border border-slate-200'
                            : 'bg-slate-900 text-white hover:bg-blue-600 hover:shadow-blue-500/30'}
          `}
                >
                    {gpsLoading ? (
                        <Loader2 className="animate-spin" size={18} />
                    ) : (
                        <MapPin size={18} />
                    )}
                    <span>{gpsLoading ? 'SYNCING...' : (!currentUser.isFreelance && !isWithinRadius) ? 'OUT OF RANGE' : 'CHECK-IN (MASUK)'}</span>
                </button>
            ) : !myAttendanceToday.timeOut ? (
                <div className="flex flex-col items-center space-y-6 w-full animate-in zoom-in duration-300">
                    <div className="bg-emerald-50 text-emerald-600 px-10 py-5 rounded-[2rem] font-black text-xs uppercase tracking-widest flex items-center space-x-4 border border-emerald-100 shadow-inner">
                        <CheckCircle2 size={24} className="animate-bounce" />
                        <div className="text-left">
                            <p className="text-[9px] opacity-70">AKTIF: {myAttendanceToday?.date}</p>
                            <p className="text-sm">MASUK JAM {myAttendanceToday?.timeIn}</p>
                        </div>
                    </div>
                    <button
                        onClick={handleStartCheckOut}
                        className="bg-rose-500 text-white px-16 py-6 rounded-[2.5rem] font-black text-xs uppercase tracking-[0.2em] hover:bg-rose-600 shadow-2xl transition transform active:scale-95 flex items-center gap-4 hover:shadow-rose-500/30"
                    >
                        <LogOut size={18} /> CHECK-OUT (PULANG)
                    </button>
                </div>
            ) : (
                <div className="space-y-6 animate-in fade-in duration-700">
                    <div className="bg-slate-900 text-white px-10 py-6 rounded-[2.5rem] font-black text-xs uppercase tracking-widest shadow-2xl border-b-4 border-blue-600 inline-block">
                        TUGAS HARI INI SELESAI
                    </div>
                    <div className="flex flex-col items-center gap-1">
                        <p className="text-slate-500 font-black text-[10px] uppercase tracking-[0.4em]">SHIFT DURATION</p>
                        <p className="text-xl font-black text-slate-800 tracking-tighter italic">{myAttendanceToday?.timeIn} <span className="text-slate-300 mx-2">➤</span> {myAttendanceToday?.timeOut}</p>
                    </div>
                </div>
            )}
        </div>
    );
};
