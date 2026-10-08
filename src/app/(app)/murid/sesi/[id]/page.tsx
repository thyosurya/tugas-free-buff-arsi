import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getSessionStats, getSessionWithTeacher, getStudentStatus } from "@/lib/repo";
import { formatDateTime } from "@/lib/format";
import { AttendanceForm } from "@/components/forms";
import {
  Alert,
  Card,
  PageHeader,
  SectionTitle,
  SessionBadge,
  Stat,
  StatusBadge,
} from "@/components/ui";

export const metadata: Metadata = {
  title: "Form Absensi",
};


export default async function StudentSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireRole("murid");
  const { id } = await params;
  const sessionId = Number(id);

  if (!Number.isInteger(sessionId)) notFound();

  const session = getSessionWithTeacher(sessionId);
  if (!session) notFound();

  /* Sesi milik kelas lain tidak boleh terlihat sama sekali. */
  if (session.kelas !== user.kelas) notFound();

  const open = session.status === "open";
  const myStatus = getStudentStatus(sessionId, user.id);
  const stats = getSessionStats(sessionId);

  return (
    <div className="space-y-10">
      <PageHeader
        kicker={`Kode ${session.code} · Kelas ${session.kelas}`}
        title={session.title}
        description={`Kelas ${session.kelas} · dibuat oleh ${session.teacher_name} · ${formatDateTime(session.created_at)}`}
        action={<SessionBadge status={session.status} />}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Hadir" value={stats.hadir} />
        <Stat label="Izin" value={stats.izin} />
        <Stat label="Sakit" value={stats.sakit} />
        <Stat label="Alfa" value={stats.alfa} />
      </div>

      <Card className="space-y-6">
        <div className="space-y-2">
          <SectionTitle meta={myStatus ? `Terakhir diperbarui` : "Belum absen"}>
            Pilih status kehadiranmu
          </SectionTitle>
          <p className="text-sm text-muted">
            Hadir untuk masuk kelas, Izin untuk surat izin, Sakit untuk surat dokter, Alfa jika
            tanpa keterangan.
          </p>
        </div>

        {myStatus ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
              Status tersimpan:
            </span>
            <StatusBadge status={myStatus} />
          </div>
        ) : null}

        {open ? (
          <AttendanceForm sessionId={session.id} current={myStatus} />
        ) : (
          <Alert kind="error">
            Sesi ini sudah ditutup oleh guru. Absensi tidak bisa diubah lagi.
          </Alert>
        )}
      </Card>

      <div className="border-t border-line pt-6">
        <Link
          href="/murid"
          className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted hover:text-ink"
        >
          ← Kembali ke daftar absensi
        </Link>
      </div>
    </div>
  );
}
