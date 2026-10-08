import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-14">
      <div className="w-full max-w-sm text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.4em] text-muted">404</p>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">Tidak ditemukan</h1>
        <p className="mt-2 text-sm text-muted">
          Halaman, sesi, atau kode yang kamu cari tidak ada — mungkin sudah dihapus atau
          salah ketik.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-ink bg-ink px-4 py-2 text-sm font-medium text-canvas transition-opacity hover:opacity-80"
          >
            Ke beranda
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-md border border-line px-4 py-2 text-sm font-medium transition-colors hover:border-ink"
          >
            Ke halaman masuk
          </Link>
        </div>
      </div>
    </main>
  );
}
