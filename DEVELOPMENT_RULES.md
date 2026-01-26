# 📜 Development Rules & Guidelines ERP SDM

Dokumen ini berfungsi sebagai "Kitab Suci" pengembangan web app ERP SDM. Semua kontributor wajib mengikuti aturan ini guna menjaga kualitas sistem tetap Enterprise-Grade.

---

## 🏗️ 1. Architecture & Clean Code
- **Full Next.js Ecosystem**: Dilarang keras menambah logic baru di folder `server/`. Gunakan Next.js App Router (`app/api/`) untuk semua endpoint.
- **Prisma as Truth**: Semua akses database harus melalui **Prisma Client**. Dilarang menggunakan raw SQL strings kecuali untuk migrasi skema yang sangat kompleks.
- **TypeScript Strict**: Tidak boleh menggunakan `any`. Selalu definisikan Interface atau Type untuk setiap data yang mengalir.
- **Component Atomicity**: Pecah komponen raksasa menjadi bagian-bagian kecil di `src/components/`. Jika sebuah file melebihi 400 baris, wajib direfaktor.

## 🚀 2. Scalability & Performance
- **No Heavy Bootstrap**: Dilarang mengirim data massal di awal login. Gunakan lazy fetching.
- **Pagination by Default**: Semua list data (transaksi, absensi, log) wajib menggunakan pagination atau infinite scroll.
- **Client-Side Caching**: Gunakan **TanStack Query (React Query)** untuk mengelola state data dari server guna menghindari re-fetch yang tidak perlu.
- **Image Optimization**: Gunakan komponen `next/image` dan kompresi untuk semua upload gambar (selfie/nota).

## 🔐 3. Security & Multi-Tenant Safety
- **Tenant Isolation**: Setiap query DATABASE wajib menyertakan filter `tenantId`.
- **Zod Validation**: Setiap endpoint API wajib melakukan validasi input menggunakan library **Zod** sebelum memproses data.
- **Row Level Security (RLS)**: Pastikan Supabase RLS aktif sebagai lapisan keamanan cadangan di level database.
- **JWT Authorization**: Gunakan `authorize()` helper di setiap API route untuk memastikan hak akses sesuai role (OWNER, MANAGER, STAFF).

## 💾 4. Data Integrity & Reliability
- **Atomic Transactions**: Fitur yang melibatkan multitabel atau multi-record (contoh: Split Transaction) wajib dibungkus dalam `prisma.$transaction`.
- **No Client-Side IDs**: Pembuatan ID (UUID/CUID) dilakukan di server atau database, bukan di frontend menggunakan `Math.random()`.
- **Soft Deletes**: Untuk data krusial (User, Account), gunakan flag `isActive` alih-alih menghapus permanen dari database.

## 📝 5. Auditability & Logging
- **Action Logging**: Setiap aktivitas `CREATE`, `UPDATE`, `DELETE` wajib mencatat log ke tabel `system_logs`.
- **Metadata**: Simpan state data *sebelum* dan *sesudah* perubahan dalam kolom `metadata_json` untuk mempermudah pelacakan jika terjadi kesalahan input/fraud.

## 🎨 6. UX & Consistency
- **Design System**: Gunakan token warna dan komponen yang sudah ada (Tailwind). Dilarang membuat gaya UI baru yang melenceng dari tema premium (Glassmorphism/Sleek Carbon).
- **Feedback Loop**: Setiap aksi user wajib memberikan feedback (Loading spinner saat proses, Toast saat sukses/error).
- **Mobile First**: ERP ini digunakan di lapangan. UI wajib 100% responsif dan nyaman digunakan di layar smartphone.

## 🛠️ 7. Extensibility
- **Feature Flags**: Gunakan kolom `featuresJson` di tabel Tenant untuk mengaktifkan/menonaktifkan modul tertentu secara dinamis.
- **Modular Components**: Desain komponen agar bisa menerima *props* yang fleksibel, memudahkan penambahan fitur di masa depan tanpa merusak fitur lama.

---

*"Code is read much more often than it is written."* - Jaga kebersihan kode Anda demi masa depan sistem ini.
