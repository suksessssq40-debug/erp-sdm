# Analisis Mendalam & Rencana Migrasi ke Next.js (Web App Modern)

## 1. Analisis Kondisi Saat Ini (Current State Analysis)

Proyek saat ini adalah aplikasi **Single Page Application (SPA)** menggunakan **Vite + React**.

- **Frontend**: Menggunakan React 19, Tailwind CSS, dan Lucide React. UI sangat premium dan interaktif.
- **Backend**: Server Express.js (`server/index.cjs`) yang terhubung ke PostgreSQL (Supabase) via `pg` driver.
- **State Management**: `store.ts` monolitik yang melakukan fetching data besar (`/api/bootstrap`) saat aplikasi dimuat.
- **Kelemahan Utama**:
  1. **Loading Performance**: User harus menunggu bundle JS download, lalu menunggu fetch API `/bootstrap` selesai baru bisa melihat konten (Waterfall).
  2. **Security**: Mengandalkan `localStorage` untuk persistensi user (`sdm_erp_current_user`), yang berisiko data usang atau manipulasi di client.
  3. **Deployment**: Vite menghasilkan file statis (`dist`), namun backend Express harus di-deploy terpisah atau memerlukan konfigurasi khusus di Vercel.

## 2. Strategi "Rombak Total" ke Next.js

Untuk memenuhi standar "Web App" modern di Vercel, kita akan migrasi ke **Next.js 14+ (App Router)**.

### Keuntungan Migrasi:

- **Server Side Rendering (SSR)**: Data dimuat di server sebelum dikirim ke browser. User langsung melihat data dashboard tanpa loading spinner lama.
- **Unified Deployment**: Frontend dan API Backend berada dalam satu repositori dan satu deployment di Vercel.
- **Security**: Auth state bisa dikelola lebih aman (Cookies/Server Session) dan API route terlindungi secara native.

### Tech Stack Target:

- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript
- **Database**: Supabase (PostgreSQL)
- **Styling**: Tailwind CSS (Existing)
- **Backend Logic**: Next.js Route Handlers (`app/api/...`) pengganti Express.

## 3. Langkah Implementasi (Step-by-Step Implementation)

Berikut adalah roadmap detail yang akan saya eksekusi:

### Phase 1: Persiapan Lingkungan (Setup)

1. Perbarui `package.json` untuk dependencies Next.js.
2. Setup `tsconfig.json` dan `next.config.js`.
3. Pindahkan source code lama ke folder backup sementara.

### Phase 2: Migrasi Backend (Express to Next.js API)

Backend Express di `server/index.cjs` akan dipecah menjadi **Next.js Route Handlers**:

- `/api/bootstrap` -> `app/api/bootstrap/route.ts`
- `/api/login` -> `app/api/login/route.ts`
- `/api/projects`, `/api/attendance`, dll.

### Phase 3: Migrasi Frontend (Components & Pages)

1. **Layouting**: Membuat `app/layout.tsx` (Global) dan `app/(dashboard)/layout.tsx` (Protected Layout dengan Sidebar).
2. **Routing**:
   - `App.tsx` routing logika akan diubah menjadi struktur folder:
     - `app/login/page.tsx`
     - `app/[role]/dashboard/page.tsx`
     - `app/[role]/kanban/page.tsx`
     - dst.
3. **State Adaptation**: `store.ts` akan dimodifikasi agar bisa menerima "Initial Data" dari Server Component, sehingga tidak perlu fetch ulang di client (Hydration).

### Phase 4: Validasi & Database

1. Pastikan koneksi Supabase via environment variables (`SUPABASE_URL`, `SUPABASE_KEY`).
2. Test alur Login -> Dashboard -> Transaction.

---

**Pemberitahuan**: Saya akan memulai proses migrasi ini sekarang. Kode lama akan aman (tidak dihapus permanen, hanya direstrukturisasi).
