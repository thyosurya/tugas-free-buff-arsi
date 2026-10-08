import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { getRecap, listClasses, listTeacherSessions } from "@/lib/repo";
import { percent } from "@/lib/format";
import { EmptyState, ClassFilter, PageHeader, SectionTitle, Stat } from "@/components/ui";

export const metadata: Metadata = {
  title: "Rekap Kehadiran",
};

export default async function RecapPage({
  searchParams,
}: {
  searchParams: Promise<{ kelas?: string }>;
}) {
  const user = await requireRole("guru");
  const classes = listClasses();
  const { kelas: kelasParam } = await searchParams;
  const active = kelasParam && classes.includes(kelasParam) ? kelasParam : undefined;

  const rows = getRecap(user.id, active);
  const totalSessions = listTeacherSessions(user.id, active).length;
  const csvHref = active ? `/guru/rekap/csv?kelas=${encodeURIComponent(active)}` : "/guru/rekap/csv";

  const totals = rows.reduce(
    (acc, row) => ({
      hadir: acc.hadir + row.hadir,
      izin: acc.izin + row.izin,
      sakit: acc.sakit + row.sakit,
      alfa: acc.alfa + row.alfa,
    }),
    { hadir: 0, izin: 0, sakit: 0, alfa: 0 },
  );

  const overall = totals.hadir + totals.izin + totals.sakit + totals.alfa;

  return (
    <div className="space-y-10">
      <PageHeader
        kicker="Guru"
        title="Rekap kehadiran"
        description={`Akumulasi ${totalSessions} sesi untuk ${rows.length} murid${active ? ` kelas ${active}` : " (semua kelas)"}.`}
        action={
          <Link
            href={csvHref}
            className="inline-flex items-center rounded-md border border-line px-4 py-2 text-sm font-medium transition-colors hover:border-ink"
          >
            Unduh CSV
          </Link>
        }
      />

      <ClassFilter base="/guru/rekap" classes={classes} active={active} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="Hadir" value={totals.hadir} />
        <Stat label="Izin" value={totals.izin} />
        <Stat label="Sakit" value={totals.sakit} />
        <Stat label="Alfa" value={totals.alfa} />
        <Stat label="Kehadiran" value={percent(totals.hadir, overall)} />
      </div>

      <section className="space-y-4">
        <SectionTitle meta={`${rows.length} murid${active ? ` · ${active}` : ""}`}>Per murid</SectionTitle>

        {rows.length === 0 ? (
          <EmptyState
            title="Belum ada data murid"
            description="Tambahkan murid ke sistem, lalu mereka bisa absen memakai kode sesi."
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-line bg-panel">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-line text-left font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
                  <th className="px-4 py-3 font-normal">Nama</th>
                  <th className="px-4 py-3 font-normal">Kelas</th>
                  <th className="px-4 py-3 font-normal">Username</th>
                  <th className="px-4 py-3 text-right font-normal">Absen</th>
                  <th className="px-4 py-3 text-right font-normal">Hadir</th>
                  <th className="px-4 py-3 text-right font-normal">Izin</th>
                  <th className="px-4 py-3 text-right font-normal">Sakit</th>
                  <th className="px-4 py-3 text-right font-normal">Alfa</th>
                  <th className="px-4 py-3 text-right font-normal">%</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-line last:border-0 hover:bg-canvas">
                    <td className="px-4 py-3 font-medium">{row.name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted">{row.kelas}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted">{row.username}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs">
                      {row.sudah}/{row.total_sesi}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs">{row.hadir}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs">{row.izin}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs">{row.sakit}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs">{row.alfa}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs">
                      {percent(row.hadir, row.sudah)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
