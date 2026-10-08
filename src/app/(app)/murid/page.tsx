import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { getStudentStats, listSessionsForStudent } from "@/lib/repo";
import { formatDate, formatTime, percent } from "@/lib/format";
import { JoinSessionForm } from "@/components/forms";
import {
  Card,
  EmptyState,
  PageHeader,
  SectionTitle,
  SessionBadge,
  Stat,
  StatusBadge,
} from "@/components/ui";

export const metadata: Metadata = {
  title: "Absensi Saya",
};

export default async function MuridDashboardPage() {
  const user = await requireRole("murid");
  const sessions = listSessionsForStudent(user.id, user.kelas);
  const stats = getStudentStats(user.id, user.kelas);
  const answered = stats.hadir + stats.izin + stats.sakit + stats.alfa;

  return (
    <div className="space-y-10">
      <PageHeader
        kicker={`Murid · Kelas ${user.kelas || "-"}`}
        title="Absensi saya"
        description={`Halo, ${user.name}. Masukkan kode dari guru atau pilih sesi kelas ${user.kelas} yang sedang dibuka.`}
      />

      <Card>
        <JoinSessionForm />
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="Hadir" value={stats.hadir} />
        <Stat label="Izin" value={stats.izin} />
        <Stat label="Sakit" value={stats.sakit} />
        <Stat label="Alfa" value={stats.alfa} />
        <Stat label="Kehadiran" value={percent(stats.hadir, answered)} />
      </div>

      <section className="space-y-4">
        <SectionTitle meta={`${sessions.length} sesi · ${stats.belum} belum absen`}>
          Riwayat sesi
        </SectionTitle>

        {sessions.length === 0 ? (
          <EmptyState
            title="Belum ada sesi absensi"
            description="Minta kode sesi kepada guru, lalu masukkan pada formulir di atas."
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-line bg-panel">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-line text-left font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
                  <th className="px-4 py-3 font-normal">Sesi</th>
                  <th className="px-4 py-3 font-normal">Guru</th>
                  <th className="px-4 py-3 font-normal">Dibuat</th>
                  <th className="px-4 py-3 font-normal">Status sesi</th>
                  <th className="px-4 py-3 font-normal">Absensi saya</th>
                  <th className="px-4 py-3 text-right font-normal">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => (
                  <tr key={session.id} className="border-b border-line last:border-0 hover:bg-canvas">
                    <td className="px-4 py-3">
                      <span className="font-medium">{session.title}</span>
                      <span className="ml-2 font-mono text-[11px] tracking-[0.16em] text-muted">
                        {session.code} · {session.kelas}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted">{session.teacher_name}</td>
                    <td className="px-4 py-3 text-muted">
                      {formatDate(session.created_at)}, {formatTime(session.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <SessionBadge status={session.status} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={session.my_status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/murid/sesi/${session.id}`}
                        className="font-mono text-[11px] uppercase tracking-[0.16em] underline underline-offset-4 hover:opacity-60"
                      >
                        {session.status === "open" ? "Absen" : "Lihat"}
                      </Link>
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
