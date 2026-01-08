# Analisis Kritis & Panduan Strategi Deployment: Next.js + Hostinger

## 🚨 STATUS MERAH: Analisis Paket Hosting

Berdasarkan gambar paket "Premium Web Hosting" (Rp 23.900/bln) yang Anda lampirkan, terdapat **KETIDAKCOCOKAN TEKNIS FATAL** dengan source code aplikasi `erp-sdm` Anda saat ini.

### Fakta Teknis:

1.  **Aplikasi Anda**: Dibangun menggunakan **Next.js 14 Fullstack**. Ini berarti aplikasi Anda bukan sekadar file HTML/CSS biasa. Ia memiliki "Otak" (Server) yang menjalankan logika API, Database (Prisma), dan Rendering halaman. "Otak" ini bernama **Node.js**.
2.  **Paket Hostinger Premium**: Dalam gambar tertulis **"(-) Tidak ada aplikasi web Node.js"**. Ini artinya server tersebut **TIDAK MEMILIKI OTAK** untuk menjalankan aplikasi Anda.

### Apa yang terjadi jika Anda memaksakan upload ke Hostinger Premium?

- **Halaman Blank/Error**: Website tidak akan tampil.
- **API Mati**: Semua fitur Login, Absensi, Transaksi akan gagal total karena `app/api/...` butuh Node.js.
- **Database Gagal**: Prisma Client tidak bisa berjalan di lingkungan PHP biasa.

---

## ✅ OPSI A: Strategi "Hybrid" (Rekomendasi Utama)

**Kombinasi: Vercel (App) + Supabase (Database) + Hostinger (Domain & Cron)**

Ini adalah cara paling modern, performa tinggi, dan mudah dikelola.

| Komponen        | Platform      | Alasan Teknis                                             |
| :-------------- | :------------ | :-------------------------------------------------------- |
| **App Node.js** | **Vercel**    | Gratis, CI/CD Otomatis, Serverless, Edge Network.         |
| **Database**    | **Supabase**  | PostgreSQL Native (Sesuai kode Anda).                     |
| **Domain**      | **Hostinger** | Beli domain di sini (Rp 0/thn pertama di beberapa paket). |
| **Cron Job**    | **Hostinger** | Gunakan untuk memicu laporan harian otomatis.             |

### Kelebihan Opsi A:

1.  **Zero Maintenance**: Tidak perlu urus server/update panel.
2.  **Deployment Kilat**: `git push` langsung live.
3.  **Skalabilitas**: Tahan banting trafik tinggi.

---

## ⚠️ OPSI B: Migrasi ke Hostinger "Business" (Paket Rp 38.900)

**Status: KOMPATIBEL (TAPI LEBIH RUMIT)**

Berdasarkan gambar **Paket Business** yang Anda tunjukkan (ada fitur **"5 aplikasi web Node.js"**), paket ini **BISA** menjalankan aplikasi Anda.

### Syarat Menjalankan di Opsi B:

1.  **Database Wajib Remote**: Hostinger hanya memberi MySQL. Kode Anda pakai PostgreSQL. Anda **HARUS** tetap menaruh database di **Supabase**. Jangan coba-coba migrasi ke MySQL Hostinger kecuali siap coding ulang backend besar-besaran.
2.  **Deployment Manual**: Tidak se-otomatis Vercel. Anda perlu:
    - Setting Node.js version di hPanel.
    - Upload file via FTP atau Git manual.
    - Menjalankan `npm install` & `npm run build` di terminal SSH Hostinger.
    - Mengatur `Process Management` (PM2) agar app tidak mati.

### Kesimpulan Opsi B:

Ambil paket ini JIKA Anda ingin memusatkan tagihan di satu tempat (Hostinger) dan siap dengan sedikit kerumitan setting server di awal.

---

## 🛠️ PANDUAN SETUP (Pilih Salah Satu)

### JIKA PILIH OPSI A (Hybrid - Vercel):

Ikuti langkah "Tahap 1" hingga "Tahap 3" di bawah ini.

### JIKA PILIH OPSI B (Hostinger Business):

1.  Beli Paket Business.
2.  Di hPanel, cari menu **Node.js**.
3.  Upload kode `erp-sdm`.
4.  Hubungkan ke Database Supabase via `.env` (Sama seperti lokal).
5.  Start App.

### Tahap 3: Setup Cron Job di Hostinger (Fungsi Vital)

Ini adalah trik untuk mengotomatiskan laporan harian menggunakan server Hostinger.

1.  Login ke **hPanel** (Hostinger).
2.  Cari menu **Advanced** -> **Cron Jobs**.
3.  Di bagian "Add New Cron Job", pilih tipe **Custom**.
4.  **Command to run**:
    ```bash
    curl -X GET "https://erp.datasdm.com/api/cron/daily-recap?force=true&key=RahasiaNegara123"
    ```
    _(Ganti `RahasiaNegara123` dengan kode yang Anda buat di Tahap 1)_
5.  **Schedule**: Masukkan jam yang diinginkan (Misal: `0` menit, `18` jam, `*` hari, `*` bulan, `*` hari seminggu untuk jam 18:00 setiap hari).
6.  Simpan.

### Tahap 4: Update Kode (Saya akan lakukan ini untuk Anda)

Saya perlu mengupdate kode `app/api/cron/daily-recap/route.ts` agar bisa menerima "Password Rahasia" (`key`) dari Hostinger.

1.  Menambahkan pengecekan `searchParams.get('key')`.
2.  Membandingkan dengan `process.env.CRON_SECRET`.

---

## 💡 Opsi Lain: "Saya Mau Hosting Semuanya Sendiri!" (VPS)

JIka Anda bersikeras ingin melepas Vercel dan Supabase, Anda **TIDAK BISA** menggunakan paket "Premium Web Hosting" (Shared).
Anda harus membeli paket **VPS (Virtual Private Server)** (biasanya KVM 1 atau KVM 2 di Hostinger).

- **Kelebihan**: Kontrol penuh, bisa install Node.js, Postgres, Redis.
- **Kekurangan**: Harus setup Linux manual, security patch manual, backup manual, jauh lebih ribet.

**REKOMENDASI SAYA**: Tetap pada **Strategi Hybrid**. Itu paling stabil, mudah, dan murah untuk skala saat ini.
