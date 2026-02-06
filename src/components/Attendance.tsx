
import React, { useState, useRef, useEffect } from 'react';
import { Attendance, AppSettings, User, UserRole, Tenant, Shift } from '@/types';
import { calculateDistance } from '../utils';
import { Camera, MapPin, Loader2 } from 'lucide-react';
import { OFFICE_RADIUS_METERS } from '../constants';
import { useToast } from './Toast';
import { LoadingState } from './LoadingState';

// Sub-Components
import { AttendancePortal } from './attendance/AttendancePortal';
import { AttendanceHistory } from './attendance/AttendanceHistory';
import { AdminConfigurations } from './attendance/AdminConfigurations';
import { AttendanceSuccess } from './attendance/AttendanceSuccess';
import { LateReasonModal } from './attendance/LateReasonModal';

interface AttendanceProps {
  isLoading?: boolean;
  currentUser: User;
  currentTenant: Tenant | null;
  shifts: Shift[];
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
  "Wah, macet ya? Atau bantalnya posesif banget pagi ini? 😂",
  "Jam dindingnya lari ya? Semangat ya, telat dikit nggak apa-apa asal kerja pol-polan. 🔥",
  "Telat itu manusiawi, tapi kalau tiap hari itu hobi. 😂 Semangat!",
  "Telat dicatat, prestasi jangan sampai lewat. 💪",
  "Otw-nya kelamaan ya? 😂 Lain kali pakai pesawat pribadi aja. Semangat!"
];

const AttendanceModule: React.FC<AttendanceProps> = ({
  isLoading, currentUser, currentTenant, shifts, settings, attendanceLog,
  onAddAttendance, onUpdateAttendance, onUpdateSettings, toast, uploadFile
}) => {
  const [stage, setStage] = useState<'IDLE' | 'CHECKING_LOCATION' | 'SELFIE' | 'LATE_REASON' | 'SUCCESS'>('IDLE');
  const [isCheckOut, setIsCheckOut] = useState(false);
  const [location, setLocation] = useState<{ lat: number, lng: number } | null>(null);
  const [isLate, setIsLate] = useState(false);
  const [lateReason, setLateReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successQuote, setSuccessQuote] = useState('');

  // Strategy Config
  const strategy = currentTenant?.workStrategy || 'FIXED';
  const radiusLimit = currentTenant?.radiusTolerance || 50;
  const graceMinutes = currentTenant?.lateGracePeriod || 15;
  const [selectedShiftId, setSelectedShiftId] = useState<string>('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [currentDate, setCurrentDate] = useState(new Date());
  const [serverOffset, setServerOffset] = useState(0);

  // CLOCK SYNC (Ensures Anti-Fraud by using Server Time)
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
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDate(new Date(Date.now() + serverOffset));
    }, 1000);
    return () => clearInterval(timer);
  }, [serverOffset]);

  // DATE LOGIC (FIXED: Consistent Jakarta Timezone)
  const getTodayJakarta = () => {
    const now = new Date();
    // Convert to Jakarta timezone (UTC+7)
    const jakartaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
    return jakartaTime.toISOString().split('T')[0]; // Format: YYYY-MM-DD
  };

  const todayStr = getTodayJakarta();

  // ACTIVE SESSION TRACKING (New Robust Logic from Dashboard)
  const myAttendanceToday = React.useMemo(() => {
    if (!currentUser?.id) return undefined;

    // Get all my attendance records
    const myLogs = attendanceLog.filter(a => a.userId === currentUser.id);

    // 1. Find today's record (exact date match)
    const todayRecord = myLogs.find(a => a.date === todayStr);

    if (todayRecord) return todayRecord;

    // 2. Fallback: Check if there's an active session from yesterday (night shift)
    // This handles case where user checked in at 23:00 yesterday, now it's 01:00 today
    const yesterdayLogs = myLogs.filter(a => {
      if (!a.date) return false;
      const logDate = new Date(a.date + 'T00:00:00');
      const today = new Date(todayStr + 'T00:00:00');
      const diffDays = Math.floor((today.getTime() - logDate.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays === 1; // Exactly 1 day ago
    });

    // Find the most recent one that's still open (no checkout)
    const activeSession = yesterdayLogs.find(a => !a.timeOut);

    if (activeSession) {
      // Verify it's really recent (within 24 hours) check validity
      const checkInTime = activeSession.createdAt
        ? new Date(activeSession.createdAt).getTime()
        : new Date(activeSession.date + 'T' + (activeSession.timeIn || '00:00:00')).getTime();

      const hoursSinceCheckIn = (Date.now() - checkInTime) / (1000 * 60 * 60);

      if (hoursSinceCheckIn < 24) {
        return activeSession; // Valid active session
      }
    }

    return undefined;
  }, [attendanceLog, currentUser.id, todayStr]);

  // CAMERA INITIALIZATION LOGIC
  useEffect(() => {
    if (stage === 'SELFIE') {
      const startCamera = async () => {
        try {
          // Small delay to ensure videoRef is rendered
          await new Promise(resolve => setTimeout(resolve, 100));
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false
          });
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        } catch (err) {
          console.error("Camera access error:", err);
          toast.error("Gagal mengakses kamera. Mohon izinkan akses kamera di browser Anda.");
          setStage('IDLE');
        }
      };
      startCamera();
    } else {
      // Cleanup: Stop camera tracks when leaving SELFIE stage
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
    }
  }, [stage]);

  // GPS WATCHER
  const [gpsLoading, setGpsLoading] = useState(true);
  const [currentDistance, setCurrentDistance] = useState<number | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [liveLocation, setLiveLocation] = useState<{ lat: number, lng: number } | null>(null);

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
      (err) => { setGpsLoading(false); },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
    return () => navigator.geolocation.clearWatch(watcher);
  }, [settings.officeLocation]);

  const handleStartCheckIn = () => {
    setIsCheckOut(false);
    if (strategy === 'SHIFT' && !selectedShiftId) {
      toast.error("Harap pilih SHIFT Anda terlebih dahulu.");
      return;
    }
    if (!liveLocation && !currentUser.isFreelance) {
      toast.error("Sedang mencari lokasi... Tunggu indikator jarak muncul.");
      return;
    }

    const dist = currentDistance || 0;
    if (!currentUser.isFreelance && dist > radiusLimit) {
      toast.error(`Gagal: Lokasi masih terlalu jauh (${Math.round(dist)}m). Batas: ${radiusLimit}m.`);
      return;
    }

    const now = new Date(Date.now() + serverOffset);
    const jakartaTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
    let isLateCheck = false;
    let limitTimeStr = '08:00';

    if (strategy === 'FIXED') {
      limitTimeStr = settings.officeHours?.start || '08:00';
    } else if (strategy === 'SHIFT') {
      const s = shifts.find(sh => sh.id === selectedShiftId);
      limitTimeStr = s?.startTime || '08:00';
    }

    if (strategy !== 'FLEXIBLE') {
      const [h, m] = limitTimeStr.split(':').map(Number);
      const startTime = new Date(jakartaTime);
      startTime.setHours(h, m, 0);
      startTime.setMinutes(startTime.getMinutes() + graceMinutes);
      isLateCheck = jakartaTime > startTime;
    }

    setIsLate(isLateCheck);
    setLocation(liveLocation as any);
    setStage(isLateCheck ? 'LATE_REASON' : 'SELFIE');
  };

  const handleStartCheckOut = () => {
    setIsCheckOut(true);
    setLocation(liveLocation || { lat: 0, lng: 0 });
    setStage('SELFIE');
  };

  const capturePhoto = () => {
    if (isSubmitting || !canvasRef.current || !videoRef.current) return;
    const video = videoRef.current;
    if (video.readyState !== 4) {
      toast.error("Kamera belum siap, coba lagi.");
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (ctx && video.videoWidth > 0) {
      setIsSubmitting(true);
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.6);

      if (video.srcObject) (video.srcObject as MediaStream).getTracks().forEach(t => t.stop());

      const finalize = async (url: string) => {
        try {
          if (isCheckOut && myAttendanceToday) {
            await onUpdateAttendance({
              ...myAttendanceToday,
              timeOut: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
              checkOutSelfieUrl: url
            });
            setSuccessQuote(CHECK_OUT_QUOTES[Math.floor(Math.random() * CHECK_OUT_QUOTES.length)]);
          } else {
            const record: Attendance = {
              id: Math.random().toString(36).substr(2, 9),
              userId: currentUser.id,
              date: todayStr, // Corrected variable
              timeIn: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
              isLate,
              lateReason: isLate ? lateReason : undefined,
              selfieUrl: url,
              location: location || { lat: 0, lng: 0 },
              shiftId: selectedShiftId || undefined
            };
            await onAddAttendance(record);
            setSuccessQuote(isLate
              ? LATE_CHECK_IN_QUOTES[Math.floor(Math.random() * LATE_CHECK_IN_QUOTES.length)]
              : CHECK_IN_QUOTES[Math.floor(Math.random() * CHECK_IN_QUOTES.length)]
            );
          }
          setStage('SUCCESS');
        } catch (e) {
          toast.error("Gagal menyimpan data.");
          setStage('SELFIE');
        } finally {
          setIsSubmitting(false);
        }
      };

      if (uploadFile) {
        const byteString = atob(dataUrl.split(',')[1]);
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
        const blob = new Blob([ab], { type: 'image/jpeg' });
        const file = new File([blob], `selfie_${Date.now()}.jpg`, { type: 'image/jpeg' });
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
    toast.info("Mencari koordinat terbaik...");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        if (window.confirm(`Set lokasi kantor baru?\nLat: ${lat}\nLng: ${lng}`)) {
          onUpdateSettings({ officeLocation: { lat, lng } });
          toast.success("Lokasi Kantor Diperbarui!");
        }
      },
      () => toast.error("Gagal ambil lokasi."),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  if (isLoading) return <LoadingState text="Menghubungkan ke satelit GPS..." />;

  const timeString = currentDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  const dateString = currentDate.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const isAdmin = [UserRole.OWNER, UserRole.MANAGER, UserRole.FINANCE].includes(currentUser.role);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-12">
      <div className="lg:col-span-2 space-y-6">
        <div className="h-full min-h-[550px]">
          {stage === 'IDLE' && (
            <AttendancePortal
              timeString={timeString}
              dateString={dateString}
              currentUser={currentUser}
              currentTenant={currentTenant}
              strategy={strategy}
              radiusLimit={radiusLimit}
              currentDistance={currentDistance}
              gpsAccuracy={gpsAccuracy}
              gpsLoading={gpsLoading}
              selectedShiftId={selectedShiftId}
              setSelectedShiftId={setSelectedShiftId}
              shifts={shifts}
              myAttendanceToday={myAttendanceToday}
              handleStartCheckIn={handleStartCheckIn}
              handleStartCheckOut={handleStartCheckOut}
              onViewReport={() => window.location.href = `/${currentUser.tenantId || 'sdm'}/${currentUser.role.toLowerCase()}/attendance/report`}
            />
          )}

          {stage === 'LATE_REASON' && (
            <LateReasonModal
              lateReason={lateReason}
              setLateReason={setLateReason}
              onContinue={() => setStage('SELFIE')}
            />
          )}

          {stage === 'SELFIE' && (
            <div className="w-full h-full bg-white p-10 rounded-[3rem] shadow-xl border border-slate-100 flex flex-col items-center justify-center space-y-8 animate-in zoom-in duration-500">
              <div className="text-center">
                <h3 className="text-2xl font-black text-slate-800 uppercase italic">Verifikasi Wajah</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">SISTEM BIOMETRIK AKTIF</p>
              </div>
              <div className="relative rounded-[3rem] overflow-hidden bg-slate-900 aspect-video w-full max-w-lg shadow-2xl border-4 border-white group">
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
                <canvas ref={canvasRef} className="hidden" />
                <div className="absolute inset-0 border-[2px] border-white/20 rounded-[3rem] pointer-events-none" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-64 border-2 border-white/30 border-dashed rounded-[50%]" />
              </div>
              <button
                onClick={capturePhoto}
                disabled={isSubmitting}
                className="w-full max-w-lg bg-blue-600 text-white py-6 rounded-[2rem] font-black text-xs uppercase tracking-widest flex items-center justify-center space-x-3 shadow-xl shadow-blue-500/30 hover:bg-blue-700 transition-all disabled:opacity-50 active:scale-95"
              >
                {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : <Camera size={20} />}
                <span>{isSubmitting ? 'MENYIMPAN DATA...' : `IDENTIFIKASI & SELESAIKAN`}</span>
              </button>
              <button onClick={() => setStage('IDLE')} className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-rose-500 transition-colors">BATALKAN</button>
            </div>
          )}

          {stage === 'SUCCESS' && (
            <AttendanceSuccess
              quote={successQuote}
              isCheckOut={isCheckOut}
              onBack={() => setStage('IDLE')}
            />
          )}
        </div>
      </div>

      <div className="space-y-6 flex flex-col">
        <div className="flex-1 min-h-[400px]">
          <AttendanceHistory
            attendanceLog={attendanceLog}
            currentUserId={currentUser.id}
            todayISO={todayStr} // Corrected variable
          />
        </div>

        {isAdmin && (
          <div className="shrink-0">
            <AdminConfigurations
              settings={settings}
              shifts={shifts}
              strategy={strategy}
              radiusLimit={radiusLimit}
              selectedShiftId={selectedShiftId}
              onUpdateSettings={onUpdateSettings}
              onSetOfficeLocation={handleSetOfficeLocation}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default AttendanceModule;
