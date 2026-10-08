import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { listClasses, listTeacherSessions } from "@/lib/repo";
import { formatDate, formatTime } from "@/lib/format";
import { CreateSessionForm } from "@/components/forms";
import {
  Card,
  ClassFilter,
  EmptyState,
  PageHeader,
  SectionTitle,
  SessionBadge,
} from "@/components/ui";

export const metadata: Metadata = {
  title: "Dasbor Guru",
};

export default async function GuruDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ kelas?: string }>;
}) {
  const user = await requireRole("guru");
  const classes = listClasses();
  const { kelas: kelasParam } = await searchParams;
  const active = kelasParam && classes.includes(kelasParam) ? kelasParam : undefined;
  const sessions = listTeacherSessions(user.id, active);

  return (
    <div className="space-y-10">
      <PageHeader
        kicker="Guru"
        title="Sesi absensi"
        description={`Halo, ${user.name}. Buat sesi untuk satu kelas, bagikan kode-nya, lalu pantau siapa yang sudah absen.`}
      />

      <Card>
        <CreateSessionForm classes={classes} />
      </Card>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SectionTitle meta={`${sessions.length} sesi`}>
            Riwayat sesi
          </SectionTitle>
        </div>
        <ClassFilter base="/guru" classes={classes} active={active} />

        {sessions.length === 0 ? (
          <EmptyState
            title="Belum ada sesi absensi"
            description="Buat sesi pertama di atas. Kode unik 6 karakter akan dibuat otomatis."
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-line bg-panel">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-line text-left font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
                  <th className="px-4 py-3 font-normal">Kode</th>
                  <th className="px-4 py-3 font-normal">Sesi</th>
                  <th className="px-4 py-3 font-normal">Kelas</th>
                  <th className="px-4 py-3 font-normal">Dibuat</th>
                  <th className="px-4 py-3 font-normal">Absen</th>
                  <th className="px-4 py-3 font-normal">Status</th>
                  <th className="px-4 py-3 text-right font-normal">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => (
                  <tr key={session.id} className="border-b border-line last:border-0 hover:bg-canvas">
                    <td className="px-4 py-3 font-mono text-xs tracking-[0.18em]">{session.code}</td>
                    <td className="px-4 py-3 font-medium">{session.title}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted">{session.kelas}</td>
                    <td className="px-4 py-3 text-muted">
                      {formatDate(session.created_at)}, {formatTime(session.created_at)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {session.marked}/{session.total_students}
                    </td>
                    <td className="px-4 py-3">
                      <SessionBadge status={session.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/guru/sesi/${session.id}`}
                        className="font-mono text-[11px] uppercase tracking-[0.16em] underline underline-offset-4 hover:opacity-60"
                      >
                        Lihat
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
