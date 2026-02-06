
# 🚀 ERP Deployment & Maintenance Guide (Best Practices)

Panduan ini disusun untuk memastikan transisi sistem ERP Anda berjalan **100% lancar** tanpa kehilangan data atau error runtime.

---

## 🛠️ 1. Persiapan Environment (.env)
Pastikan file `.env` di server produksi memiliki variabel berikut:

```env
# Database (Supabase / Postgres)
DATABASE_URL="postgresql://..."

# Security
JWT_SECRET="GunakanStringRandomYangKuat"

# PWA Push Notifications (Gunakan VAPID Keys yang sudah kita generate)
VAPID_PUBLIC_KEY="BP4MK..."
VAPID_PRIVATE_KEY="ozigk..."
NEXT_PUBLIC_VAPID_PUBLIC_KEY="BP4MK..."

# Telegram Integration
TELEGRAM_BOT_TOKEN="85687..."

# Cron Security (Untuk Recap Harian)
CRON_SECRET="AturStringRahasiaDisini"
```

---

## 📦 2. Langkah "Push" (Update) yang Benar

### Step 1: Sinkronisasi Database
Setiap kali ada perubahan pada `schema.prisma` (seperti penambahan table `push_subscriptions`), jalankan perintah ini:
```bash
# Sinkronkan schema ke database asli
npx prisma db push

# Generate ulang Prisma Client agar fitur baru terbaca di code
npx prisma generate
```

### Step 2: Build Aplikasi
Next.js memerlukan proses kompilasi agar berjalan dengan performa maksimal (Standalone mode):
```bash
npm run build
```

### Step 3: Jalankan Aplikasi
Gunakan PM2 atau sistem manager lainnya untuk menjaga aplikasi tetap hidup:
```bash
# Direct run
npm start

# Via PM2 (Direkomendasikan)
pm2 start npm --name "sdm-erp" -- start
```

---

## 🛡️ 3. Audit Keamanan & Data Integrity

Sistem yang baru telah dilengkapi dengan fitur **fail-safe**:
1. **Recursive Serialization**: Semua data angka besar (BigInt) otomatis dikonversi agar dashboard tidak blank/putih.
2. **System Log**: Setiap tindakan Admin/User tercatat di database. Jangan hapus tabel `system_logs`.
3. **Jakarta Time Locking**: Waktu absen dikunci di sisi server (Asia/Jakarta), sehingga User tidak bisa menipu jam absen dengan mengubah waktu di HP mereka.

---

## 🔔 4. Tips PWA & Push Notification
Agar notifikasi push berjalan sempurna di HP staf:
*   Pastikan domain sudah menggunakan **HTTPS**. Service Worker & Push API tidak akan jalan di HTTP biasa.
*   Jika User tidak menerima notifikasi, minta mereka untuk **"Add to Home Screen"** ulang dan memberikan izin (Permission) saat aplikasi meminta akses notifikasi.

---

## 🛑 5. Menonaktifkan Server Lama (Express)
Karena semua API sudah dipindahkan ke folder `/app/api` (Next.js), Anda sekarang **WAJIB** mematikan server Express (Port 4000). 
* Cukup stop process `node server/index.cjs`.
* Frontend sekarang akan berkomunikasi langsung ke domain utama (Port 3000).

---
**Peringatan:** Selalu lakukan Backup database di Supabase sebelum menjalankan `npx prisma db push` dalam skala besar.
