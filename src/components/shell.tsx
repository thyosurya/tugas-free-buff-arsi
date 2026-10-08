import { logout } from "@/lib/actions";
import type { SessionUser } from "@/lib/auth";
import { NavLinks, type NavItem } from "./nav";

const NAV: Record<SessionUser["role"], NavItem[]> = {
  guru: [
    { href: "/guru", label: "Sesi" },
    { href: "/guru/rekap", label: "Rekap" },
    { href: "/guru/murid", label: "Murid" },
  ],
  murid: [{ href: "/murid", label: "Absensi" }],
};

export function Shell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b border-line bg-canvas/90 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-5">
          <div className="flex items-center gap-6">
            <a
              href={user.role === "guru" ? "/guru" : "/murid"}
              className="font-mono text-[11px] font-medium uppercase tracking-[0.28em]"
            >
              Absensi Kelas
            </a>
            <div className="hidden sm:block">
              <NavLinks items={NAV[user.role]} />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm leading-tight">{user.name}</p>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
                {user.role} · {user.username}
              </p>
            </div>
            <form action={logout}>
              <button
                type="submit"
                className="rounded-md border border-line px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.16em] transition-colors hover:border-ink"
              >
                Keluar
              </button>
            </form>
          </div>
        </div>
        <div className="sm:hidden">
          <div className="mx-auto w-full max-w-5xl px-5 py-2">
            <NavLinks items={NAV[user.role]} />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-10">{children}</main>

      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-2 px-5 py-5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
          <span>Absensi Kelas · Next.js + SQLite</span>
          <span>Monokrom / Minimalis</span>
        </div>
      </footer>
    </div>
  );
}
