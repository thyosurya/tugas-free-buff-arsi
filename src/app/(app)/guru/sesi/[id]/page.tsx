import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getSession, getRoster, getSessionStats } from "@/lib/repo";
import { formatDate, formatTime } from "@/lib/format";
import { CloseSessionButton, CopyButton } from "@/components/forms";
import {
  PageHeader,
  SectionTitle,
  SessionBadge,
  Stat,
  StatusBadge,
} from "@/components/ui";

export const metadata: Metadata = {
  title: "Detail Sesi",
};

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireRole("guru");
  const { id } = await params;
  const sessionId = Number(id);

  if (!Number.isInteger(sessionId)) notFound();

  const session = getSession(sessionId);
  if (!session || session.teacher_id !== user.id) notFound();

  const roster = getRoster(sessionId, session.kelas);
  const stats = getSessionStats(sessionId);
  const belum = Math.max(roster.length - stats.marked, 0);
  const open = session.status === "open";

  return (
    <div className="space-y-10">
      <PageHeader
        kicker={`${open ? "Sesi dibuka" : "Sesi ditutup"} · ${session.kelas}`}
        title={session.title}
        description={`Kelas ${session.kelas} · dibuat ${formatDate(session.created_at)} pukul ${formatTime(session.created_at)}.`}
        action={<SessionBadge status={session.status} />}
      />

      <section className="flex flex-wrap items-center justify-between gap-6 rounded-lg border border-ink bg-panel px-6 py-6">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted">
            Kode sesi
          </p>
          <p
            data-testid="session-code"
            className="mt-2 font-mono text-4xl font-medium tracking-[0.28em] sm:text-5xl"
          >
            {session.code}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <CopyButton value={session.code} />
          <Link
            href={`/guru/sesi/${session.id}/csv`}
            className="inline-flex items-center rounded-md border border-line px-4 py-2 text-sm font-medium transition-colors hover:border-ink"
          >
            Unduh CSV
          </Link>
        </div>
      </section>

      <section className="space-y-4">
        <SectionTitle meta={`${stats.marked} dari ${roster.length} murid`}>
          Rekap sesi ini
        </SectionTitle>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Stat label="Hadir" value={stats.hadir} />
          <Stat label="Izin" value={stats.izin} />
          <Stat label="Sakit" value={stats.sakit} />
          <Stat label="Alfa" value={stats.alfa} />
          <Stat label="Belum" value={belum} />
        </div>
      </section>

      <section className="space-y-4">
        <SectionTitle meta={`${roster.length} murid ${session.kelas}`}>
          Daftar murid
        </SectionTitle>
        <div className="overflow-x-auto rounded-lg border border-line bg-panel">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-line text-left font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
                <th className="w-10 px-4 py-3 font-normal">No</th>
                <th className="px-4 py-3 font-normal">Nama</th>
                <th className="px-4 py-3 font-normal">Username</th>
                <th className="px-4 py-3 font-normal">Absensi</th>
                <th className="px-4 py-3 text-right font-normal">Waktu</th>
              </tr>
            </thead>
            <tbody>
              {roster.map((student, index) => (
                <tr
                  key={student.id}
                  className="border-b border-line last:border-0 hover:bg-canvas"
                >
                  <td className="px-4 py-3 font-mono text-xs text-muted">{index + 1}</td>
                  <td className="px-4 py-3 font-medium">{student.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted">{student.username}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={student.status} />
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-muted">
                    {student.marked_at ? formatTime(student.marked_at) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6">
        <Link
          href="/guru"
          className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted hover:text-ink"
        >
          ← Kembali ke daftar sesi
        </Link>
        {open ? <CloseSessionButton sessionId={session.id} /> : null}
      </div>
    </div>
  );
}
