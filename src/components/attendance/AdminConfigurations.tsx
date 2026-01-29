
import React from 'react';
import { AppSettings, Shift, UserRole } from '@/types';
import { Settings as SettingsIcon, MapPin, Clock, ShieldCheck } from 'lucide-react';

interface AdminConfigurationsProps {
    settings: AppSettings;
    shifts: Shift[];
    strategy: string;
    radiusLimit: number;
    selectedShiftId: string;
    onUpdateSettings: (settings: Partial<AppSettings>) => void;
    onSetOfficeLocation: () => void;
}

export const AdminConfigurations: React.FC<AdminConfigurationsProps> = ({
    settings, shifts, strategy, radiusLimit, selectedShiftId, onUpdateSettings, onSetOfficeLocation
}) => {
    return (
        <div className="bg-slate-900 text-white p-8 rounded-[3rem] shadow-2xl space-y-6 animate-in slide-in-from-right duration-700 h-full border border-white/5">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <h4 className="font-black text-xs uppercase tracking-[0.2em] text-blue-400">Control Panel</h4>
                <ShieldCheck size={16} className="text-blue-500/50" />
            </div>

            <div className="space-y-6">
                {strategy === 'FIXED' ? (
                    <>
                        <div className="flex justify-between items-center group">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover:text-slate-300 transition-colors">JAM MASUK</span>
                            <input
                                type="time"
                                className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs font-black text-white outline-none focus:bg-white/10 focus:border-blue-500 transition-all"
                                value={settings.officeHours.start}
                                onChange={e => onUpdateSettings({ officeHours: { ...settings.officeHours, start: e.target.value } })}
                            />
                        </div>
                        <div className="flex justify-between items-center group">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover:text-slate-300 transition-colors">JAM PULANG</span>
                            <input
                                type="time"
                                className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs font-black text-white outline-none focus:bg-white/10 focus:border-blue-500 transition-all"
                                value={settings.officeHours.end}
                                onChange={e => onUpdateSettings({ officeHours: { ...settings.officeHours, end: e.target.value } })}
                            />
                        </div>
                    </>
                ) : strategy === 'SHIFT' ? (
                    <div className="p-5 bg-white/5 rounded-2xl border border-white/10">
                        <div className="flex items-center gap-2 mb-3">
                            <Clock size={12} className="text-purple-400" />
                            <p className="text-[10px] font-black text-purple-400 uppercase tracking-widest">MODE SHIFT AKTIF</p>
                        </div>
                        {selectedShiftId ? (
                            <div className="space-y-1">
                                <p className="text-xs font-bold text-white uppercase">{shifts.find(s => s.id === selectedShiftId)?.name}</p>
                                <p className="text-[10px] font-black text-slate-400">
                                    Jam Operasional: {shifts.find(s => s.id === selectedShiftId)?.startTime} - {shifts.find(s => s.id === selectedShiftId)?.endTime}
                                </p>
                            </div>
                        ) : (
                            <p className="text-[10px] font-bold text-slate-500 italic">Harap pilih shift untuk melihat detail jam kerja.</p>
                        )}
                    </div>
                ) : (
                    <div className="p-5 bg-white/5 rounded-2xl border border-white/10">
                        <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest mb-1">STRATEGI FLEXIBLE</p>
                        <p className="text-[10px] font-bold text-slate-500 italic">Sistem menghitung durasi total tanpa jam masuk kaku.</p>
                    </div>
                )}

                <div className="pt-6 border-t border-white/10">
                    <div className="flex justify-between items-end mb-4">
                        <div>
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] mb-1">RADIUS GEOFENCE</p>
                            <p className="text-xl font-black text-white italic">{radiusLimit}<span className="text-[10px] ml-1 not-italic">METER</span></p>
                        </div>
                        <div className="text-right">
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] mb-1">GPS COORDINATES</p>
                            <p className="text-[10px] font-mono text-blue-400">{settings.officeLocation.lat.toFixed(4)}, {settings.officeLocation.lng.toFixed(4)}</p>
                        </div>
                    </div>

                    <button
                        onClick={onSetOfficeLocation}
                        className="w-full bg-blue-600/90 text-white py-4 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 active:scale-95"
                    >
                        <MapPin size={14} /> KALIBRASI TITIK GPS KANTOR
                    </button>
                    <p className="text-[8px] text-slate-500 mt-3 text-center uppercase font-bold tracking-widest">Kalibrasi akan menggunakan lokasi Anda saat ini</p>
                </div>
            </div>
        </div>
    );
};
