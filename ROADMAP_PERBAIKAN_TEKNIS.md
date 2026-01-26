# Roadmap Menuju Keunggulan Teknis ERP SDM

Dokumen ini berisi analisis strategis dan rencana aksi teknis untuk mentransformasi sistem ERP Anda dari "Split-Brain Architecture" yang rapuh menjadi sistem Enterprise-Grade yang kokoh, mudah dikembangkan, dan siap untuk deployment jangka panjang (Vercel atau Hostinger VPS). Seluruh pengembangan wajib mengikuti [DEVELOPMENT_RULES.md](./DEVELOPMENT_RULES.md).

---

## 🛑 Fase 0: Stabilisasi & Pembersihan Arsitektur (URGENT)

**Masalah:** Saat ini sistem memiliki **Dua Otak (Split-Brain)**. `server/index.cjs` (Express) dan `app/api/` (Next.js) berjalan bersamaan melakukan hal yang seringkali tumpang tindih. Ini adalah bom waktu maintenance.
**Validasi:** Jika app Anda dideploy ke Vercel sekarang, folder `server/` **TIDAK AKAN BERJALAN** (kecuali dikonfigurasi khusus yang rumit).

### Langkah Aksi:

1.  **Stop Pengembangan di `server/`**: Jangan menambah fitur baru di folder `server`.
2.  **Audit `app/api` vs `server/index.cjs`**:
    - Pastikan semua endpoint di `server/index.cjs` sudah ada padanannya di `app/api`.
    - _Fakta:_ Dari analisis file Anda, `app/api` sudah memiliki folder `auth` (login), `projects`, `attendance`, `finance`. Ini pertanda baik.
3.  **Kill Switch**: Ubah variable environment frontend (`NEXT_PUBLIC_API_BASE`) menjadi kosong `''`. Ini akan memaksa frontend menggunakan `app/api` (Next.js internal API).
    - Jika ada error, berarti endpoint tersebut belum dimigrasi. Fix endpoint di `app/api`.
4.  **Hapus Folder `server/`**: Setelah poin 3 stabil, hapus total folder `server/`.

---

## 🏗️ Fase 1: Modernisasi Database (Foundation Layer)

**Masalah:** Query SQL manual (`SELECT * FROM table`) sangat rawan error dan sulit di-refactor. Tidak ada jaminan tipe data antara Database <-> Kode TypeScript.

### Langkah Aksi: Implementasi Prisma ORM

Prisma adalah standard industri saat ini untuk Node.js/TypeScript.

1.  **Install Prisma**: `npm install prisma --save-dev`
2.  **Introspeksi DB**: Jalankan `npx prisma db pull`. Prisma akan membaca database Supabase Anda dan membuat file `schema.prisma` otomatis yang 100% akurat sesuai tabel Anda yang ada.
3.  **Generate Client**: `npx prisma generate`.
4.  **Refactor Bertahap**: Mulai ganti query manual di `app/api` dengan Prisma Client.
    - _Lama:_ `pool.query('SELECT * FROM users WHERE id = $1', [id])`
    - _Baru:_ `prisma.users.findUnique({ where: { id } })`
    - _Benefit:_ Autocomplete, Type Safety, Anti-SQL Injection otomatis.

---

## ⚡ Fase 2: Optimasi Performa (Frontend)

**Masalah:** Aplikasi memuat **SEMUA DATA** saat login (`/api/bootstrap`). Saat data transaksi mencapai ribuan, login akan freeze 10-20 detik. Penggunaan `store.ts` raksasa menyebabkan render ulang yang tidak perlu.

### Langkah Aksi: Pindah ke TanStack Query (React Query)

1.  **Hapus `/api/bootstrap`**: Fitur ini tidak scalable.
2.  **Fetch on Demand**:
    - Halaman "Projects" -> Fetch hanya data projects.
    - Halaman "Finance" -> Fetch transaksi bulan ini saja.
3.  **Caching otomatis**: React Query akan menyimpan data di cache, sehingga saat user pindah menu dan kembali, data muncul instan tanpa loading ulang.

---

## 🚀 Fase 3: Deployment Strategy (Vercel -> Hostinger)

### Opsi A: Vercel (Current Best Practice)

- **Kelebihan**: Zero config, performa global CDN tercepat, preview deployments.
- **Kekurangan**: Mahal jika trafik tinggi, batas durasi server function (max 10-60 detik).
- **Syarat**: `server/` (Express) WAJIB dihapus. Harus full Next.js App Router.

### Opsi B: Hostinger VPS (Ubuntu/Linux) - **Rencana Anda**

- **Kelebihan**: Kontrol penuh, biaya tetap (flat), bisa menjalankan long-running process (Cron jobs berat, WebSocket server custom).
- **Setup Terbaik**:
  1.  **Dockerize App**: Buat `Dockerfile` untuk membungkus aplikasi Next.js. Ini menjamin aplikasi jalan sama persis di lokal dan server.
  2.  **Coolify / Portainer**: Gunakan panel manajemen container di VPS agar deploy semudah Vercel (git push -> deploy).
  3.  **Database**: Tetap gunakan Supabase (Managed Postgres) atau host Postgres sendiri di VPS (lebih hemat tapi perlu maintenance backup manual).

---

## Ringkasan Rekomendasi "Best Practice"

1.  **Technology Stack**: Next.js App Router (Fullstack) + Prisma ORM + React Query.
2.  **Infrastructure**:
    - **DB**: Supabase (Postgres) - _Keep it, it's good._
    - **App**: Hostinger VPS (Dockerized) - _Good for cost control long term._
    - **Storage**: Supabase Storage / R2 - _Keep it._

### Langkah Konkret Pertama (Hari Ini)

Saya merekomendasikan kita mulai dengan **Fase 0 & 1** secara hibrida.

1.  Saya akan instalkan **Prisma** dan generate schema dari database Anda. Ini tidak merusak kode yang ada, tapi memberi Anda "senjata" baru untuk refactor.
2.  Kita coba matikan ketergantungan pada `server/` (Express) dengan memindahkan logic `auth` sepenuhnya ke Next.js.
