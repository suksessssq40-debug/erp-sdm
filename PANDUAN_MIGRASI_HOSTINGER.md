# 🚀 Panduan Migrasi ke Hostinger Business (Next.js)

Dokumen ini disusun khusus untuk **Web Developer Pemula**. Ikuti langkah demi langkah dengan teliti. Jangan melompat-lompat.

## ✅ TAHAP 1: Analisis Kesiapan (Readiness Check)

Sebelum membeli dan migrasi, kita cek dulu apakah kode Anda "sehat":

1.  **Database**: ✅ **AMAN**. Anda menggunakan Supabase (Remote). Hosting tidak perlu database lokal.
2.  **Storage/Upload**: ✅ **AMAN**. Anda menggunakan Supabase Storage. File upload tidak akan memenuhi disk hosting.
3.  **Teknologi**: ✅ **AMAN**. Paket Business mendukung Node.js.
4.  **Kode**: ⚠️ **PERLU PERHATIAN**. Karena Anda pemula, tantangan terbesar adalah proses "Build". Next.js membutuhkan RAM besar saat build. Di Shared Hosting, build sering gagal (Error Out of Memory).
    - _Solusi_: Kita akan gunakan fitur **Standalone Build** (sudah saya aktifkan di `next.config.js`). Kita build di laptop, upload hasilnya saja. Ini cara paling anti-gagal.

---

## 🛠️ TAHAP 2: Persiapan File Lokal (Di Laptop)

Kita akan menyiapkan "Paket Siap Upload" agar server tidak perlu kerja berat.

1.  **Stop Server Lokal**: Matikan terminal (`Ctrl + C`).
2.  **Build Proyek**: Jalankan perintah ini di terminal VSCode:
    ```powershell
    npm run build
    ```
    _(Tunggu sampai selesai. Pastikan muncul tulisan "Route (app) Size ...")_
3.  **Cari Folder Hasil**:
    Setalah sukses, akan muncul folder `.next`.
    Di dalamnya ada folder `.next/standalone`. **Inilah yang akan kita upload.**

4.  **Siapkan File "run.js"** (Agar Hostinger mudah menjalankannya):
    Buat file baru bernama `run.js` di folder root laptop Anda, isi dengan:

    ```javascript
    const { createServer } = require("http");
    const { parse } = require("url");
    const next = require("next");

    // Load .env manual jika perlu, tapi Hostinger punya fitur env sendiri.

    process.chdir(__dirname);
    const port = process.env.PORT || 3000;
    const server = require("./server"); // Ini menunjuk ke server.js di dalam folder standalone nanti

    server.listen(port, (err) => {
      if (err) throw err;
      console.log(`> Ready on http://localhost:${port}`);
    });
    ```

    _(Tunggu, abaikan langkah 4 ini dulu. Kita pakai cara paling standar Hostinger dulu. Jika gagal baru cara custom)._

---

## 🚀 TAHAP 3: Setup di Hostinger (Panel)

1.  **Beli Paket & Login**.
2.  **Setup Domain**: Ikuti wizard Hostinger untuk menghubungkan domain `erp.datasdm.com`.
3.  Masuk ke **Hosting Dashboard** -> Pilih Domain Anda.
4.  Cari menu **Advanced** -> **Node.js**. (Jangan pilih "Website Builder" atau "WordPress").
5.  **Setting Aplikasi Node.js**:
    - **Node.js Version**: Pilih **v18** atau **v20** (Sesuaikan dengan yang di laptop, cek dengan `node -v`). Recomendasi: **v20**.
    - **Application Mode**: **Production**.
    - **Application Root**: `public_html` (atau biarkan default).
    - **Application Startup File**: `server.js` (Nanti kita sesuaikan).
    - Klik **CREATE**.

---

## 📦 TAHAP 4: Upload File (Cara Paling Stabil)

Kita akan menggunakan metode "Copy Standalone" agar ringan.

1.  Buka **File Manager** di Hostinger.
2.  Masuk ke folder `public_html`. **Hapus semua file default** (seperti `default.php`).
3.  Di Laptop Anda, buka folder `.next/standalone`.

    - Copy **SEMUA ISI** folder `standalone` ini (folder `.next`, `server.js`, `package.json`, dll) ke dalam `public_html` Hostinger.
    - **PENTING**: Copy juga folder `public` (dari root folder laptop) ke `public_html/public` di Hostinger.
    - **PENTING**: Copy folder `.next/static` (dari root folder laptop) ke `public_html/.next/static` di Hostinger.

    _Struktur akhir di File Manager Hostinger harus seperti ini:_

    ```text
    /public_html
       ├── .next
       │     ├── server
       │     └── static  <-- HASIL COPY DARI .next/static
       ├── public        <-- HASIL COPY DARI public
       ├── node_modules  <-- (Otomatis ada dari standalone)
       ├── server.js     <-- (Otomatis ada dari standalone)
       └── package.json
    ```

---

## 🔑 TAHAP 5: Konfigurasi Environment (Kunci Rahasia)

Di menu **Node.js** Hostinger tadi:

1.  Cari bagian **Environment Variables**.
2.  Masukkan satu per satu data dari file `.env` Anda:
    - Key: `DATABASE_URL` -> Value: (Copy dari .env)
    - Key: `SUPABASE_URL` -> Value: ...
    - Key: `SUPABASE_KEY` -> Value: ...
    - Key: `JWT_SECRET` -> Value: ...
    - Key: `CRON_SECRET` -> Value: ...
    - Key: `PORT` -> Value: `3000` (Penting!)
3.  Klik **Save**.

---

## ▶️ TAHAP 6: Menjalankan Server

1.  Di menu **Node.js** Hostinger.
2.  Pastikan **Application Startup File** diisi `server.js`.
3.  Klik tombol **NPM INSTALL** (Hanya untuk memastikan, meski standalone sudah bawa modules, kadang perlu rebuild native). _Jika standalone, langkah ini sering bisa diskip._
4.  Klik tombol **RESTART** atau **START**.
5.  Tunggu status menjadi "Online" atau indikator hijau.

---

## ❓ Troubleshooting (Jika Gagal)

Jika aplikasi error "Internal Server Error" atau "503":

1.  Buka tab **NPM Install** di Hostinger, pastikan tidak error.
2.  Pastikan folder `.next/static` sudah tercopy benar. Standalone mode sering lupa folder ini.
3.  Cek koneksi database.
4.  Jika masih sulit, **hubungi Support Hostinger**. Paket Business punya **Priority Support**. Bilang saja: _"I create Next.js App with Standalone Output. How to run it correctly?"_ Mereka akan bantu setup path-nya.

**Ringkasan Checklist Migrasi:**

- [ ] Build lokal sukses (`npm run build`).
- [ ] Upload isi `.next/standalone` ke Hostinger.
- [ ] Upload folder `public` dan `.next/static` manual.
- [ ] Isi Environment Variables di Hostinger.
- [ ] Start Server.
