# Absensi Kelas

Aplikasi absensi kelas online dengan dua aktor — **guru** dan **murid** — dibangun dengan
Next.js (App Router), TypeScript, Tailwind CSS, dan SQLite. Tampilan memakai palet
monokrom (hitam / putih / abu) yang ringan dan minimalis, mendukung mode gelap bawaan
sistem.

## Fitur

**Guru**

- Membuka sesi absensi untuk **satu kelas** → mendapat kode unik 6 karakter.
- Memantau daftar murid **sekelas** beserta status absensi dan waktunya.
- Menutup sesi (murid tidak bisa lagi mengubah absensi).
- Rekap kehadiran per murid, dengan **filter kelas** (semua kelas atau satu kelas).
- **Kelola murid & kelas**: tambah murid (termasuk kelas baru), pindahkan antar kelas,
  **ganti nama kelas** (murid & sesi lama ikut berpindah), atau hapus akun.
- Mengunduh data dalam format CSV (UTF-8, siap dibuka di Excel), ikut tersaring filter kelas.

**Murid**

- Hanya melihat sesi milik kelasnya sendiri; kode dari kelas lain ditolak.
- Masuk ke sesi memakai kode dari guru.
- Memilih status: **Hadir / Izin / Sakit / Alfa**, masih bisa diubah selama sesi dibuka.
- Melihat riwayat seluruh sesi kelasnya beserta statusnya.
- Melihat ringkasan kehadiran diri sendiri.

## Menjalankan

```bash
npm install
npm run dev        # http://localhost:3000
```

Produksi:

```bash
npm run build
npm start
```

Basis data SQLite dibuat otomatis di `data/absensi.db` (folder ini di-gitignore) beserta
akun demo berikut. Dibagi atas dua kelas:

| Peran | Username   | Password   | Kelas     |
| ----- | ---------- | ---------- | --------- |
| Guru  | `guru`     | `guru123`  | —         |
| Murid | `murid01`  | `murid123` | XI IPA 2 |
| Murid | `murid05`  | `murid123` | XI IPS 1 |

Murid lain: `murid02`–`murid04` (XI IPA 2) dan `murid06`–`murid08` (XI IPS 1), password
sama (`murid123`). Hapus folder `data/` untuk mengembalikan data ke keadaan awal.

## Alur penggunaan

1. Guru masuk → pilih kelas → isi judul → **Buat sesi & kode** → bagikan kode (mis. `A3K7PD`).
2. Murid kelas itu masuk → tempel kode → pilih **Hadir** (atau status lain).
3. Guru membuka sesi tersebut untuk melihat daftar murid, lalu **Tutup sesi**.
4. Guru membuka tab **Rekap**, pilih kelas lewat chip filter, lalu unduh CSV bila perlu.
5. Tab **Murid** dipakai untuk menambah murid, membuat kelas baru, memindahkan murid,
   mengganti nama kelas, atau menghapus akun.

Murid dari kelas lain akan ditolak dengan pesan "Kode itu untuk kelas …", dan sesi
kelas lain tidak muncul di daftarnya.

## Struktur kode

```
src/lib/
  db.ts        inisialisasi SQLite + skema + seed akun
  auth.ts      session cookie (httpOnly), guard peran guru/murid
  repo.ts      seluruh query & mutasi data
  actions.ts   server actions (login, buat sesi, absen, tutup sesi)
  format.ts    daftar status + format tanggal Indonesia
  csv.ts       penulisan CSV
src/components/
  ui.tsx       primitives monokrom (Card, Stat, badge, tabel)
  shell.tsx    header, navigasi aktor, tombol keluar
  forms.tsx    form klien ber-`useActionState`
src/app/
  login/                 halaman masuk
  (app)/guru/            dasbor guru, detail sesi, rekap + ekspor CSV
  (app)/murid/           dasbor murid, form absensi
```

## Pengujian end-to-end

```bash
npm run build && npm start   # di terminal pertama (port 3000)
npm run test:e2e             # di terminal lain
```

Skrip `scripts/e2e.mjs` menjalankan Chrome sungguhan (puppeteer-core) dan memverifikasi:
guard autentikasi **di tingkat HTTP (307 tanpa JavaScript)**, halaman 404 khusus untuk
sesi tak valid, nama aksesibel tiap kontrol form, pembuatan sesi, **isolasi antar-kelas**,
join via kode, absen & ubah status, penutupan sesi, filter kelas di dasbor/rekap,
**kelola murid** (tambah, pindah kelas, **ganti nama kelas**, hapus, tolak username
ganda), rekap, unduhan CSV, **palet mode gelap lewat emulasi `prefers-color-scheme` di
semua halaman beserta perbandingan kontras**, serta pengalihan antar-peran.

Pemeriksaan migrasi untuk basis data yang dibuat sebelum kolom `kelas` ada:

```bash
# 1. hentikan server dan hapus data/, lalu:
node scripts/migration-check.mjs --prepare
# 2. npm start di terminal lain, lalu:
node scripts/migration-check.mjs
```

Pemeriksaan flag cookie `Secure` (login sungguhan tanpa JavaScript, ke server yang
sedang jalan):

```bash
node scripts/cookie-secure-check.mjs
```

## Catatan teknis

- Autentikasi memakai token acak 32 byte di cookie `httpOnly` + tabel `auth_sessions`
  yang kedaluwarsa dalam 7 hari; password di-hash dengan `scrypt`. Flag `secure` diisi
  otomatis hanya bila `x-forwarded-proto: https`, jadi login tetap jalan di demo lokal
  (localhost maupun IP jaringan) tetap ketat saat di-deploy HTTPS — diverifikasi
  `scripts/cookie-secure-check.mjs`.
- `better-sqlite3` didaftarkan pada `serverExternalPackages` agar modul native tidak
  dibundel.
- Route yang membaca cookie dibuat dinamis. Mode **Cache Components sengaja dimatikan**
  di `next.config.ts`: pada mode itu Next mengirim shell prerender ber-status 200 lalu
  mengalirkan konten, sehingga `redirect()` (pengunjung tanpa login) dan `notFound()`
  (sesi tidak ada) tidak pernah terbaca sebagai status HTTP 307/404 oleh klien tanpa
  JavaScript. Dengan mode klasik, keempat route terproteksi membalas **307 → `/login`**
  dan sesi tak valid membalas **404** — keduanya diverifikasi e2e.
- Kolom `kelas` ada di tabel `users` (murid) dan `sessions`. Database lama otomatis
  dimigrasi lewat `ensureColumns()`; murid lama diberi kelas `"Tanpa kelas"` supaya tetap
  bisa diabsen, lalu dipindah lewat tab **Murid**. Untuk data contoh dua kelas, hapus
  `data/` agar di-seed ulang (lihat `scripts/migration-check.mjs`).
