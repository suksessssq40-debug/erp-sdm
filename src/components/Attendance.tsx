
import React, { useState, useRef, useEffect } from 'react';
import { Attendance, AppSettings, User, UserRole } from '@/types';
import { calculateDistance } from '../utils';
import { Camera, MapPin, AlertCircle, CheckCircle2, History, Clock, LogOut, Loader2 } from 'lucide-react';
import { OFFICE_RADIUS_METERS } from '../constants';
import { useToast } from './Toast';

interface AttendanceProps {
  currentUser: User;
  settings: AppSettings;
  attendanceLog: Attendance[];
  onAddAttendance: (record: Attendance) => void;
  onUpdateAttendance: (record: Attendance) => void;
  onUpdateSettings: (settings: Partial<AppSettings>) => void;
  toast: ReturnType<typeof useToast>;
  uploadFile?: (file: File) => Promise<string>;
}

const CHECK_IN_QUOTES = [
  "Semangat pagi! Jangan lupa senyum, biar kerjanya nggak berasa beban. 😊",
  "Datang tepat waktu? Wah, calon orang sukses nih! 🚀",
  "Selamat bertarung dengan deadline! Tenang, pasti menang. 💪",
  "Pintu rezeki sudah dibuka, yuk masuk dengan bismillah. ✨",
  "Kehadiranmu hari ini adalah kunci sukses tim kita. Welcome back! 👑",
  "Oit! Semangat ya hari ini, kopi sudah menanti di meja. ☕"
];

const CHECK_OUT_QUOTES = [
  "Pekerjaan selesai! Saatnya mode 'healing' diaktifkan. 🧘‍♂️",
  "Terima kasih untuk kerja keras hari ini. Tidur nyenyak ya! 😴",
  "Hati-hati di jalan, jangan kebut-kebutan, ada yang nunggu di rumah. 🏠",
  "Besok kita guncang dunia lagi! Selamat beristirahat, Champion. 🏆",
  "Jangan lupa bahagia ya, kerjaan mah nggak ada habisnya. See you! 👋",
  "Bye-bye kantor! Jangan bawa kerjaan ke dalam mimpi ya. ✨"
];

const LATE_CHECK_IN_QUOTES = [
  "Wah, macet ya? Atau bantalnya posesif banget pagi ini? 😂 Tenang, yang penting selamat sampai kantor!",
  "Jam dindingnya lari ya? Semangat ya, telat dikit nggak apa-apa asal kerja pol-polan. 🔥",
  "Telat itu manusiawi, tapi kalau tiap hari itu hobi. 😂 Semangat, yuk mulai kerjanya!",
  "Matahari sudah tinggi, semangat juga harus tinggi! Telat dicatat, prestasi jangan sampai lewat. 💪",
  "Otw-nya kelamaan ya? 😂 Lain kali pakai pesawat pribadi aja. Semangat kerjanya!"
];

const AttendanceModule: React.FC<AttendanceProps> = ({ currentUser, settings, attendanceLog, onAddAttendance, onUpdateAttendance, onUpdateSettings, toast, uploadFile }) => {
  const [stage, setStage] = useState<'IDLE' | 'CHECKING_LOCATION' | 'SELFIE' | 'LATE_REASON' | 'SUCCESS'>('IDLE');
  const [isCheckOut, setIsCheckOut] = useState(false);
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);
  const [isLate, setIsLate] = useState(false);
  const [lateReason, setLateReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [currentDate, setCurrentDate] = useState(new Date());
  const [serverOffset, setServerOffset] = useState(0);

  // CLOCK SYNC
  useEffect(() => {
    const syncTime = async () => {
       try {
         const start = Date.now();
         const res = await fetch(`/api/chat/messages?roomId=ping`, { method: 'HEAD' });
         const end = Date.now();
         const latency = (end - start) / 2;
         
         const serverDateStr = res.headers.get('Date');
         if (serverDateStr) {
            const serverByHeader = new Date(serverDateStr).getTime();
            const estimatedServerTime = serverByHeader + latency;
            const offset = estimatedServerTime - Date.now();
            setServerOffset(offset);
            setCurrentDate(new Date(Date.now() + offset));
         }
       } catch (e) {
         console.warn("Failed to sync server time", e);
       }
    };
    syncTime();
  }, [settings.officeHours]);

  useEffect(() => {
    const timer = setInterval(() => {
        setCurrentDate(new Date(Date.now() + serverOffset));
    }, 1000);
    return () => clearInterval(timer);
  }, [serverOffset]);

  const todayStr = new Date(Date.now() + serverOffset).toDateString();
  
  // Cross-Day Logic: Find the latest "Open" session (no checkout) within reasonable timeframe (e.g. 24h)
  // This allows 5 PM - 1 AM shifts to still show "Check Out" at 1 AM the next day.
  const myAttendanceToday = React.useMemo(() => {
    const myLogs = attendanceLog.filter(a => a.userId === currentUser.id);
    // Sort desc
    myLogs.sort((a, b) => {
        const tA = a.createdAt ? Number(a.createdAt) : new Date(a.date).getTime();
        const tB = b.createdAt ? Number(b.createdAt) : new Date(b.date).getTime();
        return tB - tA;
    });

    const latest = myLogs[0];
    if (!latest) return undefined;

    // If latest record has NO timeOut (Belum pulang)
    if (!latest.timeOut) {
        // Check age of record to avoid picking up very old stale sessions (e.g. forgot last week)
        const tLatest = latest.createdAt ? Number(latest.createdAt) : new Date(latest.date).getTime();
        const diffHours = (Date.now() - tLatest) / (1000 * 60 * 60);
        
        // If within 24 hours, consider it the active session for Today/Tonight
        if (diffHours < 24) {
            return latest;
        }
    }

    // Fallback: If closed or stale, check if we have a fresh new "Today" entry (standard logic)
    // Note: If sorting is correct, 'latest' would be today's if it exists.
    // But we double check date string just in case.
    if (latest.date === todayStr) return latest;
    
    return undefined;
  }, [attendanceLog, currentUser.id, todayStr]);

  const [gpsLoading, setGpsLoading] = useState(true);
  const [currentDistance, setCurrentDistance] = useState<number | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [liveLocation, setLiveLocation] = useState<{lat: number, lng: number} | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) return;
    const watcher = navigator.geolocation.watchPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLiveLocation(coords);
        setGpsAccuracy(pos.coords.accuracy);
        const dist = calculateDistance(coords.lat, coords.lng, settings.officeLocation.lat, settings.officeLocation.lng);
        setCurrentDistance(dist);
        setGpsLoading(false);
      },
      (err) => {
        console.warn("GPS Watch Error:", err);
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
    return () => navigator.geolocation.clearWatch(watcher);
  }, [settings.officeLocation]);

  const handleStartCheckIn = () => {
    setIsCheckOut(false);
    if (!liveLocation && !currentUser.isFreelance) {
      toast.error("Sedang mencari lokasi... Tunggu indikator jarak muncul.");
      return;
    }
    const dist = currentDistance || 0;
    const now = new Date();
    const [h, m] = (settings.officeHours?.start || '08:00').split(':').map(Number);
    const startTime = new Date();
    startTime.setHours(h, m, 0);
    const isLateCheck = now > startTime;
    setIsLate(isLateCheck);
    setLocation(liveLocation as any);

    if (!currentUser.isFreelance && dist > OFFICE_RADIUS_METERS) {
      toast.error(`Gagal: Lokasi masih terlalu jauh (${Math.round(dist)}m). Mendekatlah ke kantor.`);
      return;
    }
    setStage(isLateCheck ? 'LATE_REASON' : 'SELFIE');
  };

  const handleStartCheckOut = () => {
    setIsCheckOut(true);
    setLocation(liveLocation || { lat: 0, lng: 0 });
    setStage('SELFIE');
  };

  const startCamera = async () => {
    try {
      if (videoRef.current?.srcObject) return;
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => videoRef.current?.play().catch(console.error);
      }
    } catch (e) {
      toast.error("Akses kamera ditolak.");
      setStage('IDLE');
    }
  };

  useEffect(() => {
    if (stage === 'SELFIE') startCamera();
    return () => {
      if (videoRef.current?.srcObject) (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
    };
  }, [stage]);

  const capturePhoto = () => {
    if (isSubmitting || !canvasRef.current || !videoRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (ctx && video.videoWidth > 0) {
      setIsSubmitting(true);
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      if (video.srcObject) (video.srcObject as MediaStream).getTracks().forEach(t => t.stop());

      const finalize = async (url: string) => {
        try {
          if (isCheckOut && myAttendanceToday) {
            await onUpdateAttendance({
              ...myAttendanceToday,
              timeOut: new Date().toLocaleTimeString('id-ID'),
              checkOutSelfieUrl: url
            });
          } else {
            const record: Attendance = {
              id: Math.random().toString(36).substr(2, 9),
              userId: currentUser.id,
              date: todayStr, 
              timeIn: new Date().toLocaleTimeString('id-ID'),
              isLate,
              lateReason: isLate ? lateReason : undefined,
              selfieUrl: url,
              location: location || { lat: 0, lng: 0 }
            };
            await onAddAttendance(record);
          }
          setStage('SUCCESS');
          
          let quotes = CHECK_IN_QUOTES;
          if (isCheckOut) {
            quotes = CHECK_OUT_QUOTES;
          } else if (isLate) {
            quotes = LATE_CHECK_IN_QUOTES;
          }
          
          toast.success(quotes[Math.floor(Math.random() * quotes.length)]);
        } catch (e) {
          toast.error("Gagal menyimpan data.");
          setStage('SELFIE');
        } finally {
          setIsSubmitting(false);
        }
      };

      if (uploadFile) {
        // Convert Base64 to Blob helper
        const byteString = atob(dataUrl.split(',')[1]);
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
        const blob = new Blob([ab], { type: 'image/jpeg' });
        const file = new File([blob], `selfie_${Date.now()}.jpg`, { type: 'image/jpeg' });

        toast.info("Mengupload selfie...");
        uploadFile(file).then(finalize).catch(() => {
          toast.error("Upload gagal.");
          setIsSubmitting(false);
          setStage('SELFIE');
        });
      } else {
        finalize(dataUrl);
      }
    }
  };

  const handleSetOfficeLocation = () => {
    if (!navigator.geolocation) return toast.error("Tidak didukung Geolocation");
    toast.info("Mencari koordinat...");
    navigator.geolocation.getCurrentPosition(
       (pos) => {
          const { latitude: lat, longitude: lng } = pos.coords;
          if (window.confirm(`Set lokasi kantor?\nLat: ${lat}\nLng: ${lng}`)) {
             onUpdateSettings({ officeLocation: { lat, lng } });
             toast.success("Lokasi diperbarui!");
          }
       },
       () => toast.error("Gagal ambil lokasi."),
       { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const timeString = currentDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  const dateString = currentDate.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-white p-10 rounded-[3rem] shadow-xl border border-slate-100 flex flex-col items-center justify-center text-center space-y-8 min-h-[500px] relative overflow-hidden">
          {stage === 'IDLE' && (
            <>
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
                                currentUser.name.charAt(0)
                             )}
                         </div>
                    </div>
                </div>

                <div className="w-24 h-24 bg-blue-100 rounded-[2rem] flex items-center justify-center text-blue-600 shadow-lg shadow-blue-50 mb-2">
                   <Clock size={48} />
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-3xl font-black text-slate-800 tracking-tight">Portal Absensi SDM</h3>
                <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Silahkan lakukan absensi masuk atau pulang harian</p>
                
                {/* LIVE GPS INDICATOR */}
                {!myAttendanceToday && stage === 'IDLE' && (
                  <div className={`p-4 rounded-2xl flex items-center justify-between border shadow-sm transition-colors duration-500
                    ${gpsLoading ? 'bg-slate-50 border-slate-200' : 
                      (currentDistance || 0) <= OFFICE_RADIUS_METERS ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700'}
                  `}>
                    <div className="flex items-center gap-3">
                       <div className={`w-3 h-3 rounded-full animate-pulse ${gpsLoading ? 'bg-slate-400' : (currentDistance || 0) <= OFFICE_RADIUS_METERS ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                       <div>
                          <p className="text-[10px] font-black uppercase tracking-widest opacity-70">STATUS LOKASI</p>
                          <p className="text-xs font-black">
                             {gpsLoading ? 'MENCARI GPS...' : 
                              (currentDistance || 0) <= OFFICE_RADIUS_METERS ? `DALAM AREA (${Math.round(currentDistance!)}m)` : `DILUAR AREA (${Math.round(currentDistance!)}m)`}
                          </p>
                       </div>
                    </div>
                    {!gpsLoading && (
                       <div className="text-right">
                          <p className="text-[9px] font-bold opacity-60">AKURASI</p>
                          <p className="text-[10px] font-mono">{Math.round(gpsAccuracy || 0)}m</p>
                       </div>
                    )}
                  </div>
                )}
              </div>

               {/* REPORT BUTTON */}
                <button 
                 onClick={() => window.location.href = `/${currentUser.tenantId || 'sdm'}/${currentUser.role.toLowerCase()}/attendance/report`}
                className="md:absolute md:top-8 md:right-8 w-full md:w-auto mt-6 md:mt-0 bg-white border border-slate-200 text-slate-600 px-6 py-3 rounded-xl flex items-center justify-center space-x-2 text-[10px] font-black uppercase tracking-widest hover:border-blue-500 hover:text-blue-600 transition shadow-sm"
               >
                  <History size={14} /> <span>LAPORAN DETAIL</span>
               </button>


              {!myAttendanceToday ? (
                <button 
                  onClick={handleStartCheckIn}
                  disabled={gpsLoading || (!currentUser.isFreelance && (currentDistance || 9999) > OFFICE_RADIUS_METERS)}
                  className={`px-16 py-5 rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] shadow-2xl transition transform active:scale-95 flex items-center gap-3
                    ${gpsLoading || (!currentUser.isFreelance && (currentDistance || 9999) > OFFICE_RADIUS_METERS) 
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none' 
                      : 'bg-emerald-600 text-white hover:bg-emerald-700'}
                  `}
                >
                  <MapPin size={18} /> {gpsLoading ? 'MENCARI SINYAL...' : (!currentUser.isFreelance && (currentDistance || 9999) > OFFICE_RADIUS_METERS) ? 'TERLALU JAUH' : 'CHECK-IN (MASUK)'}
                </button>
              ) : !myAttendanceToday.timeOut ? (
                <div className="flex flex-col items-center space-y-6">
                   <div className="bg-emerald-50 text-emerald-600 px-8 py-4 rounded-[1.5rem] font-black text-xs uppercase tracking-widest flex items-center space-x-3 border border-emerald-100 shadow-sm">
                      <CheckCircle2 size={20} />
                      <span>Berhasil Masuk: {myAttendanceToday?.timeIn}</span>
                   </div>
                   <button 
                    onClick={handleStartCheckOut}
                    className="bg-rose-500 text-white px-16 py-5 rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] hover:bg-rose-600 shadow-2xl transition transform active:scale-95 flex items-center gap-3"
                  >
                    <LogOut size={18} /> CHECK-OUT (PULANG)
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                   <div className="bg-blue-50 text-blue-600 px-8 py-5 rounded-[2rem] font-black text-xs uppercase tracking-widest border border-blue-100 shadow-sm inline-block">
                      Absensi Hari Ini Selesai
                   </div>
                   <p className="text-slate-500 font-bold text-xs italic">Riwayat Kehadiran: {myAttendanceToday?.timeIn} - {myAttendanceToday?.timeOut}</p>
                </div>
              )}
            </>
          )}

          {stage === 'CHECKING_LOCATION' && (
            <div className="flex flex-col items-center space-y-6">
              <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center text-blue-500 animate-pulse">
                <Loader2 size={40} className="animate-spin" />
              </div>
              <p className="text-sm font-black text-slate-500 uppercase tracking-widest">Memverifikasi Geolocation...</p>
            </div>
          )}

          {stage === 'LATE_REASON' && (
            <div className="w-full max-w-md space-y-6 animate-in slide-in-from-bottom duration-300">
              <div className="bg-rose-50 p-6 rounded-[2rem] flex items-start space-x-4 text-left border border-rose-100">
                <AlertCircle className="text-rose-500 flex-shrink-0" size={24} />
                <div>
                  <h4 className="font-black text-rose-800 uppercase text-xs tracking-widest">ANDA TERLAMBAT</h4>
                  <p className="text-sm text-rose-600 font-bold mt-1">Sistem mencatat keterlambatan. Harap isi alasan.</p>
                </div>
              </div>
              <textarea 
                className="w-full p-6 bg-slate-50 border-2 border-transparent rounded-[2rem] focus:border-rose-500 focus:bg-white outline-none h-40 text-sm font-bold transition"
                placeholder="Tulis alasan terlambat..."
                value={lateReason}
                onChange={e => setLateReason(e.target.value)}
              />
              <button 
                disabled={!lateReason.trim()}
                onClick={() => setStage('SELFIE')}
                className="w-full bg-slate-900 text-white py-5 rounded-[2rem] font-black text-xs uppercase tracking-widest shadow-xl disabled:opacity-30 hover:bg-blue-600 transition"
              >
                LANJUTKAN KE SELFIE
              </button>
            </div>
          )}

          {stage === 'SELFIE' && (
            <div className="w-full max-w-lg space-y-6 animate-in zoom-in duration-300">
              <div className="relative rounded-[3rem] overflow-hidden bg-slate-900 aspect-video shadow-2xl border-4 border-white">
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
                <canvas ref={canvasRef} className="hidden" />
              </div>
              <button 
                onClick={capturePhoto}
                disabled={isSubmitting}
                className="w-full bg-blue-600 text-white py-6 rounded-[2rem] font-black text-xs uppercase tracking-widest flex items-center justify-center space-x-3 shadow-xl shadow-blue-200 hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : <Camera size={20} />}
                <span>{isSubmitting ? 'MEMPROSES DATA...' : `AMBIL FOTO & SELESAIKAN ${isCheckOut ? 'PULANG' : 'ABSENSI'}`}</span>
              </button>
            </div>
          )}

          {stage === 'SUCCESS' && (
            <div className="animate-in zoom-in duration-500">
               <div className="w-24 h-24 bg-emerald-100 rounded-[2.5rem] flex items-center justify-center text-emerald-600 shadow-xl shadow-emerald-50 mb-8 mx-auto">
                <CheckCircle2 size={48} />
              </div>
              <h3 className="text-3xl font-black text-slate-800 tracking-tight mb-2 uppercase">Absensi Berhasil!</h3>
              <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] mb-10">Data kehadiran tim Sukses Digital Media sudah tersimpan</p>
              <button onClick={() => setStage('IDLE')} className="text-blue-600 font-black uppercase text-xs tracking-widest hover:underline decoration-2">KEMBALI KE PORTAL</button>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-6">
        <div className="bg-white p-8 rounded-[3rem] shadow-xl border border-slate-100">
          <h4 className="font-black text-slate-800 mb-6 flex items-center uppercase tracking-widest text-xs">
            <History className="mr-3 text-blue-500" size={18} />
            RIWAYAT HARI INI
          </h4>
          <div className="space-y-4">
            {attendanceLog.filter(a => a.userId === currentUser.id && a.date === todayStr).reverse().map(a => (
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
                    <div className="p-3 bg-white rounded-xl border border-slate-50">
                        <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Masuk</p>
                        <p className="text-sm font-black text-slate-800">{a.timeIn}</p>
                    </div>
                    <div className="p-3 bg-white rounded-xl border border-slate-50">
                        <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Pulang</p>
                        <p className="text-sm font-black text-slate-800">{a.timeOut || '--:--'}</p>
                    </div>
                </div>

                {a.lateReason && (
                    <div className="p-3 bg-rose-50 rounded-xl border border-rose-100">
                         <p className="text-[9px] font-bold text-rose-400 uppercase mb-1">Alasan Terlambat:</p>
                         <p className="text-[10px] text-rose-700 italic font-medium">{a.lateReason}</p>
                    </div>
                )}
              </div>
            ))}
            {attendanceLog.filter(a => a.userId === currentUser.id && a.date === todayStr).length === 0 && (
                <div className="py-10 text-center space-y-3 opacity-40">
                    <Clock size={32} className="mx-auto text-slate-300" />
                    <p className="text-[10px] font-black uppercase tracking-widest">Belum ada aktivitas hari ini</p>
                </div>
            )}
          </div>
        </div>

        {currentUser.role === UserRole.OWNER && (
          <div className="bg-slate-900 text-white p-8 rounded-[3rem] shadow-2xl space-y-6 animate-in slide-in-from-right duration-700">
             <h4 className="font-black text-xs uppercase tracking-[0.2em] text-blue-400 border-b border-white/10 pb-4">Owner Configurations</h4>
             <div className="space-y-6">
                <div className="flex justify-between items-center">
                   <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">JAM MASUK</span>
                   <input 
                      type="time" 
                      className="bg-white/5 border-none rounded-xl px-4 py-2 text-xs font-black text-white outline-none focus:bg-white/10" 
                      value={settings.officeHours.start}
                      onChange={e => onUpdateSettings({ officeHours: { ...settings.officeHours, start: e.target.value } })}
                    />
                </div>
                <div className="flex justify-between items-center">
                   <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">JAM PULANG</span>
                   <input 
                      type="time" 
                      className="bg-white/5 border-none rounded-xl px-4 py-2 text-xs font-black text-white outline-none focus:bg-white/10" 
                      value={settings.officeHours.end}
                      onChange={e => onUpdateSettings({ officeHours: { ...settings.officeHours, end: e.target.value } })}
                    />
                </div>
                <div className="pt-4 border-t border-white/5">
                   <p className="text-[9px] font-black text-slate-600 uppercase tracking-[0.3em] mb-2">RADIUS AKTIF: {OFFICE_RADIUS_METERS}M</p>
                   <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">TITIK LOKASI KANTOR</p>
                   <p className="text-[10px] font-mono text-blue-400 bg-blue-400/10 p-3 rounded-xl border border-blue-400/20 mb-3">{settings.officeLocation.lat.toFixed(6)}, {settings.officeLocation.lng.toFixed(6)}</p>
                   
                   <button 
                    onClick={handleSetOfficeLocation}
                    className="w-full bg-blue-600 text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition flex items-center justify-center gap-2"
                   >
                      <MapPin size={14} /> ATUR TITIK GPS SAAT INI
                   </button>
                </div>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AttendanceModule;
