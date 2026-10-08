import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getSession, getRoster, getSessionStats } from "@/lib/repo";
import { csvResponse, toCsv } from "@/lib/csv";
import { formatDateTime } from "@/lib/format";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user || user.role !== "guru") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { id } = await params;
  const sessionId = Number(id);
  if (!Number.isInteger(sessionId)) {
    return new NextResponse("Sesi tidak valid", { status: 400 });
  }

  const session = getSession(sessionId);
  if (!session || session.teacher_id !== user.id) {
    return new NextResponse("Sesi tidak ditemukan", { status: 404 });
  }

  const roster = getRoster(sessionId, session.kelas);
  const stats = getSessionStats(sessionId);

  const rows: (string | number)[][] = [
    ["Sesi", session.title],
    ["Kelas", session.kelas],
    ["Kode", session.code],
    ["Dibuat", formatDateTime(session.created_at)],
    ["Status", session.status === "open" ? "Dibuka" : "Ditutup"],
    [],
    ["No", "Nama", "Username", "Absensi", "Waktu"],
    ...roster.map((student, index) => [
      index + 1,
      student.name,
      student.username,
      student.status ?? "Belum absen",
      student.marked_at ? formatDateTime(student.marked_at) : "",
    ]),
    [],
    ["Hadir", stats.hadir],
    ["Izin", stats.izin],
    ["Sakit", stats.sakit],
    ["Alfa", stats.alfa],
    ["Belum absen", Math.max(roster.length - stats.marked, 0)],
  ];

  return csvResponse(toCsv(rows), `absensi-${session.code}.csv`);
}
