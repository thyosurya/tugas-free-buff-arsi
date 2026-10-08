import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getRecap, listClasses, listTeacherSessions } from "@/lib/repo";
import { csvResponse, toCsv } from "@/lib/csv";
import { percent } from "@/lib/format";

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user || user.role !== "guru") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const classes = listClasses();
  const kelasParam = request.nextUrl.searchParams.get("kelas");
  const active = kelasParam && classes.includes(kelasParam) ? kelasParam : undefined;

  const rows = getRecap(user.id, active);
  const totalSessions = listTeacherSessions(user.id, active).length;
  const scope = active ?? "Semua kelas";

  const table: (string | number)[][] = [
    ["Rekap kehadiran", user.name],
    ["Kelas", scope],
    ["Jumlah sesi", totalSessions],
    [],
    [
      "Nama",
      "Kelas",
      "Username",
      "Total sesi",
      "Sudah absen",
      "Hadir",
      "Izin",
      "Sakit",
      "Alfa",
      "% Hadir",
    ],
    ...rows.map((row) => [
      row.name,
      row.kelas,
      row.username,
      row.total_sesi,
      row.sudah,
      row.hadir,
      row.izin,
      row.sakit,
      row.alfa,
      percent(row.hadir, row.sudah),
    ]),
  ];

  const suffix = active ? `-${active.replace(/[^A-Za-z0-9]+/g, "-").toLowerCase()}` : "";
  return csvResponse(toCsv(table), `rekap-kehadiran${suffix}.csv`);
}
