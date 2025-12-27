import React, { useState, useEffect } from 'react';
import { Building, ImageIcon, Trash2, AlignLeft, AlignCenter, AlignRight, Bot, MapPin, Clock, BellRing, CheckCircle2, Circle } from 'lucide-react';
import { CompanyProfile, UserRole } from '../types';

export const AppSettings = ({ store, toast }: any) => {
  const [botToken, setBotToken] = useState(store.settings.telegramBotToken);
  const [groupId, setGroupId] = useState(store.settings.telegramGroupId);
  const [ownerChatId, setOwnerChatId] = useState(store.settings.telegramOwnerChatId);
  const [officeLoc, setOfficeLoc] = useState(store.settings.officeLocation);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile>(store.settings.companyProfile);
  const [recapTime, setRecapTime] = useState(store.settings.dailyRecapTime || '18:00');
  const [recapModules, setRecapModules] = useState<string[]>(store.settings.dailyRecapModules || []);
  const [mapActive, setMapActive] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (mapActive) {
      import('leaflet').then(L => {
        // Ensure CSS is injected
        if (!document.getElementById('leaflet-css')) {
           const link = document.createElement('link');
           link.id = 'leaflet-css';
           link.rel = 'stylesheet';
           link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
           document.head.appendChild(link);
        }

        // Fix Webpack icon issues
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
          iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        });

        const container = document.getElementById('map-picker');
        if (!container) return;
        if ((container as any)._leaflet_id) return;
        const map = L.map('map-picker').setView([officeLoc.lat, officeLoc.lng], 15);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
        let marker = L.marker([officeLoc.lat, officeLoc.lng], { draggable: true }).addTo(map);
        marker.on('dragend', () => {
          const pos = marker.getLatLng();
          setOfficeLoc({ lat: pos.lat, lng: pos.lng });
        });
        map.on('click', (e) => {
          marker.setLatLng(e.latlng);
          setOfficeLoc({ lat: e.latlng.lat, lng: e.latlng.lng });
        });
      });
    }
  }, [mapActive, officeLoc]);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setCompanyProfile({...companyProfile, logoUrl: reader.result as string});
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await store.updateSettings({ 
        telegramBotToken: botToken, 
        telegramGroupId: groupId, 
        telegramOwnerChatId: ownerChatId, 
        officeLocation: officeLoc,
        companyProfile: companyProfile,
        dailyRecapTime: recapTime,
        dailyRecapModules: recapModules
      });
      toast.success("Konfigurasi Sistem Berhasil Diperbarui!");
    } catch (err: any) {
      toast.error(err?.message || 'Gagal menyimpan konfigurasi. Periksa koneksi dan coba lagi.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestCron = async () => {
    try {
      toast.loading("Mengecek jadwal server...");
      // Anti-cache param
      const res = await fetch(`/api/cron/daily-recap?v=${Date.now()}`); 
      const data = await res.json();
      
      if (data.skipped) {
        toast((t: any) => (
           <div className="flex items-start gap-2">
             <div className="text-amber-500"><Clock size={16}/></div>
             <div>
               <p className="font-bold text-xs uppercase">LOGIKA JADWAL BERJALAN</p>
               <p className="text-[10px] text-slate-500 mt-1">
                 Server Time: <b className="text-slate-800">{data.serverTimeWIB}</b><br/>
                 Target Setting: <b className="text-slate-800">{data.targetTime}</b>
               </p>
               <p className="text-[9px] text-slate-400 mt-1 italic">
                 "Belum waktunya dikirim (Aman)."
               </p>
             </div>
           </div>
        ), { duration: 5000 });
      } else if (data.success) {
        toast.success("✅ JADWAL COCOK! Notifikasi dikirim ke Telegram.");
      } else {
        toast.error("Terjadi kesalahan sistem: " + JSON.stringify(data));
      }
    } catch (e) {
      toast.error("Gagal menghubungi server");
    }
  };

  if (store.currentUser.role !== UserRole.OWNER) {
    return (
      <div className="p-20 text-center bg-white rounded-[4rem] shadow-xl border border-slate-100">
        <h3 className="text-2xl font-black text-rose-500 uppercase tracking-tighter">Akses Terbatas</h3>
        <p className="text-slate-400 font-bold mt-2">Tab Pengaturan hanya tersedia untuk Owner.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-10 pb-20 animate-in fade-in duration-500">
       <div className="bg-white p-12 rounded-[3rem] shadow-xl border border-slate-100 space-y-12 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 blur-3xl rounded-full -mr-16 -mt-16"></div>
          <div className="flex items-center justify-between relative z-10">
             <div className="flex items-center space-x-6">
                <div className="w-16 h-16 bg-indigo-600 rounded-[1.5rem] flex items-center justify-center text-white shadow-2xl"><Building size={32} /></div>
                <div><h3 className="text-3xl font-black text-slate-800 tracking-tight leading-none uppercase italic">Profil & Kop Perusahaan</h3><p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-2">PENGATURAN IDENTITAS RESMI SLIP GAJI</p></div>
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">LOGO PERUSAHAAN</label>
                <div className="flex gap-4">
                  {!companyProfile.logoUrl ? (
                    <label className="flex-1 h-32 bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center cursor-pointer hover:bg-blue-50 hover:border-blue-300 transition group">
                      <ImageIcon className="text-slate-300 group-hover:text-blue-500 mb-2" size={24} />
                      <span className="text-[9px] font-black text-slate-400 uppercase">UPLOAD LOGO</span>
                      <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
                    </label>
                  ) : (
                    <div className="relative flex-1 h-32 bg-slate-50 rounded-3xl border border-slate-100 overflow-hidden group">
                      <img src={companyProfile.logoUrl} alt="Logo" className="w-full h-full object-contain p-4" />
                      <button onClick={() => setCompanyProfile({...companyProfile, logoUrl: ''})} className="absolute top-2 right-2 p-2 bg-rose-500 text-white rounded-xl opacity-0 group-hover:opacity-100 transition shadow-lg">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">POSISI LOGO</label>
                    <div className="flex bg-slate-100 p-1 rounded-2xl">
                       <button onClick={() => setCompanyProfile({...companyProfile, logoPosition: 'top'})} className={`flex-1 py-3 rounded-xl transition text-[9px] font-black uppercase ${companyProfile.logoPosition === 'top' ? 'bg-white shadow text-blue-600' : 'text-slate-400'}`}>ATAS</button>
                       <button onClick={() => setCompanyProfile({...companyProfile, logoPosition: 'left'})} className={`flex-1 py-3 rounded-xl transition text-[9px] font-black uppercase ${companyProfile.logoPosition === 'left' ? 'bg-white shadow text-blue-600' : 'text-slate-400'}`}>KIRI</button>
                       <button onClick={() => setCompanyProfile({...companyProfile, logoPosition: 'right'})} className={`flex-1 py-3 rounded-xl transition text-[9px] font-black uppercase ${companyProfile.logoPosition === 'right' ? 'bg-white shadow text-blue-600' : 'text-slate-400'}`}>KANAN</button>
                    </div>
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ALIGMENT TEKS</label>
                    <div className="flex bg-slate-100 p-1.5 rounded-2xl">
                       <button onClick={() => setCompanyProfile({...companyProfile, textAlignment: 'left'})} className={`flex-1 flex items-center justify-center py-3 rounded-xl transition ${companyProfile.textAlignment === 'left' ? 'bg-white shadow text-blue-600' : 'text-slate-400'}`}>
                          <AlignLeft size={18} />
                       </button>
                       <button onClick={() => setCompanyProfile({...companyProfile, textAlignment: 'center'})} className={`flex-1 flex items-center justify-center py-3 rounded-xl transition ${companyProfile.textAlignment === 'center' ? 'bg-white shadow text-blue-600' : 'text-slate-400'}`}>
                          <AlignCenter size={18} />
                       </button>
                       <button onClick={() => setCompanyProfile({...companyProfile, textAlignment: 'right'})} className={`flex-1 flex items-center justify-center py-3 rounded-xl transition ${companyProfile.textAlignment === 'right' ? 'bg-white shadow text-blue-600' : 'text-slate-400'}`}>
                          <AlignRight size={18} />
                       </button>
                    </div>
                 </div>
              </div>

              <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">NAMA PERUSAHAAN</label>
                  <input className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-indigo-600 rounded-2xl outline-none font-black transition" value={companyProfile.name} onChange={e => setCompanyProfile({...companyProfile, name: e.target.value})} />
              </div>
              <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ALAMAT LENGKAP</label>
                  <textarea className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-indigo-600 rounded-2xl outline-none font-bold text-sm h-24 transition" value={companyProfile.address} onChange={e => setCompanyProfile({...companyProfile, address: e.target.value})} />
              </div>
              <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">TELEPON / KONTAK</label>
                  <input className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-indigo-600 rounded-2xl outline-none font-black transition" value={companyProfile.phone} onChange={e => setCompanyProfile({...companyProfile, phone: e.target.value})} />
              </div>
            </div>

            <div className="space-y-6">
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">LIVE PREVIEW KOP SURAT</label>
               <div className="bg-white border-2 border-slate-100 rounded-[3rem] p-10 aspect-[1/0.6] shadow-inner relative overflow-hidden flex flex-col justify-center">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-blue-500 to-indigo-500"></div>
                  
                  <div className={`flex w-full items-center gap-6 ${
                    companyProfile.logoPosition === 'top' ? 'flex-col' : 
                    companyProfile.logoPosition === 'right' ? 'flex-row-reverse' : 'flex-row'
                  }`}>
                    {companyProfile.logoUrl ? (
                      <img src={companyProfile.logoUrl} className="h-20 w-auto object-contain" alt="Preview Logo" />
                    ) : (
                      <div className="h-20 w-20 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-300 flex-shrink-0">
                        <ImageIcon size={32} />
                      </div>
                    )}
                    
                    <div className={`flex-1 space-y-1 ${
                      companyProfile.textAlignment === 'left' ? 'text-left' :
                      companyProfile.textAlignment === 'right' ? 'text-right' : 'text-center'
                    }`}>
                      <h4 className="text-xl font-black text-slate-800 leading-none mb-2 uppercase tracking-tight">{companyProfile.name || 'NAMA PERUSAHAAN'}</h4>
                      <p className="text-[10px] font-bold text-slate-400 leading-relaxed">{companyProfile.address || 'Alamat Perusahaan...'}</p>
                      <p className="text-[9px] font-black text-indigo-600 mt-2">{companyProfile.phone || '08xxxxxxx'}</p>
                    </div>
                  </div>
                  
                  <div className="w-full h-[1px] bg-slate-100 mt-8 mb-4"></div>
                  <div className="w-full text-center">
                    <span className="text-[8px] font-black uppercase text-slate-300 tracking-[0.4em]">ISI SLIP GAJI OTOMATIS</span>
                  </div>
               </div>
               <p className="text-[9px] font-medium text-slate-400 italic text-center leading-relaxed px-10">Tata letak di atas akan digunakan secara presisi pada PDF Slip Gaji Karyawan.</p>
            </div>
          </div>
       </div>

       <div className="bg-white p-12 rounded-[3rem] shadow-xl border border-slate-100 space-y-10 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 blur-3xl rounded-full -mr-16 -mt-16"></div>
          <div className="flex items-center space-x-6 relative z-10">
             <div className="w-16 h-16 bg-blue-600 rounded-[1.5rem] flex items-center justify-center text-white shadow-2xl"><Bot size={32} /></div>
             <div><h3 className="text-3xl font-black text-slate-800 tracking-tight leading-none uppercase italic">Koneksi Telegram</h3><p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-2">SENTRAL NOTIFIKASI & PENGIRIMAN SLIP</p></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <div className="space-y-3 md:col-span-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">BOT API TOKEN</label>
              <input type="password" className="w-full p-5 bg-slate-50 border-2 border-transparent focus:border-blue-600 focus:bg-white rounded-2xl outline-none font-mono text-xs font-bold transition shadow-inner" value={botToken} onChange={e => setBotToken(e.target.value)} placeholder="00000000:AAxxxx..." />
            </div>
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">GROUP ID (LOGS)</label>
              <input className="w-full p-5 bg-slate-50 border-2 border-transparent focus:border-blue-600 focus:bg-white rounded-2xl outline-none font-mono text-xs font-bold transition shadow-inner" value={groupId} onChange={e => setGroupId(e.target.value)} placeholder="-100xxxxxxxxx" />
            </div>
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">OWNER CHAT ID (DAILY RECAP)</label>
              <input className="w-full p-5 bg-slate-50 border-2 border-transparent focus:border-blue-600 focus:bg-white rounded-2xl outline-none font-mono text-xs font-bold transition shadow-inner" value={ownerChatId} onChange={e => setOwnerChatId(e.target.value)} placeholder="12345678" />
            </div>
          </div>
       </div>

       <div className="bg-white p-12 rounded-[3rem] shadow-xl border border-slate-100 space-y-10 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-50 blur-3xl rounded-full -mr-16 -mt-16"></div>
          <div className="flex items-center space-x-6 relative z-10">
             <div className="w-16 h-16 bg-amber-500 rounded-[1.5rem] flex items-center justify-center text-white shadow-2xl"><BellRing size={32} /></div>
             <div><h3 className="text-3xl font-black text-slate-800 tracking-tight leading-none uppercase italic">Personalisasi Notifikasi</h3><p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-2">ATUR JADWAL & KONTEN LAPORAN HARIAN</p></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div className="space-y-6">
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">JADWAL PENGIRIMAN (WIB)</label>
               <div className="flex items-center space-x-4">
                  <div className="relative flex-1">
                    <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input 
                      type="time" 
                      className="w-full pl-12 pr-4 py-5 bg-slate-50 border-2 border-transparent focus:border-amber-500 focus:bg-white rounded-2xl outline-none font-black text-xl text-slate-800 transition shadow-inner" 
                      value={recapTime} 
                      onChange={e => setRecapTime(e.target.value)} 
                    />
                  </div>
                  <div className="text-[10px] font-bold text-slate-400 max-w-[150px] leading-tight">
                    Sistem akan mengirim laporan tepat pada jam yang Anda tentukan.
                  </div>
               </div>
            </div>

            <div className="space-y-6">
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">MODUL LAPORAN YANG DIPILIH</label>
               <div className="grid grid-cols-1 gap-3">
                  {[
                    { id: 'omset', label: 'Ringkasan Omset & Keuangan', desc: 'Total pemasukan & pengeluaran hari ini' },
                    { id: 'attendance', label: 'Laporan Absensi Karyawan', desc: 'Siapa yang hadir, telat, atau tidak masuk' },
                    { id: 'requests', label: 'Permohonan Pending (Izin/Cuti)', desc: 'Info karyawan yang menunggu approval' },
                    { id: 'projects', label: 'Progress Proyek (Kanban)', desc: 'Task selesai & deadline mendekat' }
                  ].map((mod) => (
                    <button 
                      key={mod.id}
                      onClick={() => {
                        if (recapModules.includes(mod.id)) {
                          setRecapModules(recapModules.filter(m => m !== mod.id));
                        } else {
                          setRecapModules([...recapModules, mod.id]);
                        }
                      }}
                      className={`flex items-center p-4 rounded-2xl border-2 transition text-left group ${
                        recapModules.includes(mod.id) 
                          ? 'border-amber-500 bg-amber-50' 
                          : 'border-slate-100 bg-slate-50 hover:border-slate-200'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-4 transition ${
                        recapModules.includes(mod.id) ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-400'
                      }`}>
                         {recapModules.includes(mod.id) ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                      </div>
                      <div>
                         <h5 className={`font-black text-xs uppercase tracking-wide ${recapModules.includes(mod.id) ? 'text-slate-800' : 'text-slate-500'}`}>{mod.label}</h5>
                         <p className="text-[10px] font-medium text-slate-400">{mod.desc}</p>
                      </div>
                    </button>
                  ))}
               </div>
            </div>
          </div>
       </div>

       <div className="bg-white p-12 rounded-[3rem] shadow-xl border border-slate-100 space-y-10 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 blur-3xl rounded-full -mr-16 -mt-16"></div>
          <div className="flex items-center space-x-6 relative z-10">
             <div className="w-16 h-16 bg-slate-200 rounded-[1.5rem] flex items-center justify-center text-slate-500 shadow-2xl"><Bot size={32} /></div>
             <div><h3 className="text-3xl font-black text-slate-800 tracking-tight leading-none uppercase italic">Simulasi Jadwal</h3><p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-2">ALAT BANTU PENGUJIAN CRON JOB</p></div>
          </div>
          
          <div className="bg-slate-50 border border-slate-200 rounded-3xl p-8 flex flex-col md:flex-row items-center justify-between gap-6">
             <div className="flex items-start gap-6">
               <div className="p-4 bg-white rounded-2xl shadow-sm border border-slate-100 text-slate-400">
                  <Clock size={24} />
               </div>
               <div>
                  <h5 className="font-black text-sm text-slate-700 uppercase">CEK LOGIKA WAKTU SERVER</h5>
                  <p className="text-[11px] text-slate-400 max-w-sm leading-relaxed mt-2">
                    Ingin memastikan server tidak tertidur? Tombol ini akan memaksa server mengecek waktu saat ini dan membandingkannya dengan jadwal Anda, tanpa menunggu menit berganti.
                  </p>
               </div>
             </div>
             <button 
               onClick={handleTestCron}
               className="w-full md:w-auto px-8 py-4 bg-white border-2 border-slate-200 text-slate-700 font-black text-[10px] uppercase rounded-2xl hover:border-amber-500 hover:text-amber-600 hover:shadow-lg transition flex-shrink-0"
             >
               TES LOGIKA SKEDULER SEKARANG
             </button>
          </div>
       </div>

       <div className="bg-white p-12 rounded-[3rem] shadow-xl border border-slate-100 space-y-10 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 blur-3xl rounded-full -mr-16 -mt-16"></div>
          <div className="flex items-center space-x-6 relative z-10">
             <div className="w-16 h-16 bg-emerald-500 rounded-[1.5rem] flex items-center justify-center text-white shadow-2xl"><MapPin size={32} /></div>
             <div><h3 className="text-3xl font-black text-slate-800 tracking-tight leading-none uppercase italic">Geofencing Kantor</h3><p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-2">PENETAPAN RADIUS KEHADIRAN AKTIF</p></div>
          </div>
          {!mapActive ? (
            <button onClick={() => setMapActive(true)} className="w-full h-40 bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2.5rem] text-[11px] font-black uppercase text-slate-400 hover:text-blue-600 transition flex flex-col items-center justify-center gap-4 group hover:border-blue-300 shadow-inner">
               <MapPin size={32} className="group-hover:animate-bounce" /> KLIK UNTUK AKTIFKAN MAP PICKER
            </button>
          ) : (
            <div className="space-y-6 animate-in slide-in-from-top-4 duration-500">
              <div id="map-picker" className="h-[400px] w-full rounded-[2.5rem] shadow-2xl border-4 border-white z-0 overflow-hidden relative"></div>
              <div className="grid grid-cols-2 gap-4">
                 <div className="p-5 bg-slate-50 rounded-2xl text-center shadow-inner border border-slate-100"><p className="text-[9px] font-black uppercase text-slate-400 mb-1 tracking-widest">LATITUDE</p><p className="text-xs font-black text-slate-800">{officeLoc.lat.toFixed(6)}</p></div>
                 <div className="p-5 bg-slate-50 rounded-2xl text-center shadow-inner border border-slate-100"><p className="text-[9px] font-black uppercase text-slate-400 mb-1 tracking-widest">LONGITUDE</p><p className="text-xs font-black text-slate-800">{officeLoc.lng.toFixed(6)}</p></div>
              </div>
            </div>
          )}
          <button onClick={handleSave} disabled={isSaving} className="w-full bg-slate-900 text-white py-6 rounded-[2.5rem] font-black uppercase tracking-[0.2em] text-xs hover:bg-blue-600 transition shadow-2xl shadow-slate-300 disabled:opacity-50 disabled:cursor-not-allowed">
            {isSaving ? 'MENYIMPAN...' : 'SIMPAN SEMUA KONFIGURASI'}
          </button>
       </div>
    </div>
  );
};
