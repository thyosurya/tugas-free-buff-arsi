import type { Metadata } from "next";
import { changeStudentClass } from "@/lib/actions";
import { requireRole } from "@/lib/auth";
import { listClasses, listStudents } from "@/lib/repo";
import { AddStudentForm, DeleteStudentButton, RenameClassForm } from "@/components/forms";
import {
  Card,
  EmptyState,
  PageHeader,
  SectionTitle,
  buttonTiny,
  inputCompact,
  kickerClass,
} from "@/components/ui";

export const metadata: Metadata = {
  title: "Murid & Kelas",
};

export default async function StudentAdminPage() {
  const user = await requireRole("guru");
  const students = listStudents();
  const classes = listClasses();

  const perClass = new Map<string, number>();
  for (const student of students) {
    perClass.set(student.kelas, (perClass.get(student.kelas) ?? 0) + 1);
  }

  return (
    <div className="space-y-10">
      <PageHeader
        kicker="Guru"
        title="Murid & kelas"
        description={`Kamu masuk sebagai ${user.name}. Tambah murid baru, pindahkan mereka antar kelas, atau hapus akun yang sudah tidak dipakai.`}
      />

      <Card className="space-y-5">
        <p className={kickerClass}>Tambah murid</p>
        <AddStudentForm classes={classes} />
      </Card>

      <section className="space-y-4">
        <SectionTitle meta={`${students.length} murid · ${classes.length} kelas`}>
          Daftar murid
        </SectionTitle>

        {classes.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {classes.map((kelas) => (
              <span
                key={kelas}
                className="inline-flex items-center gap-2 rounded-full border border-line px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted"
              >
                {kelas}
                <span className="text-ink">{perClass.get(kelas) ?? 0}</span>
              </span>
            ))}
          </div>
        ) : null}

        {students.length === 0 ? (
          <EmptyState
            title="Belum ada murid"
            description="Tambahkan murid pertama pada formulir di atas, lengkap dengan kelasnya."
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-line bg-panel">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-line text-left font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
                  <th className="w-12 px-4 py-3 font-normal">No</th>
                  <th className="px-4 py-3 font-normal">Nama</th>
                  <th className="px-4 py-3 font-normal">Username</th>
                  <th className="px-4 py-3 font-normal">Pindah kelas</th>
                  <th className="px-4 py-3 text-right font-normal">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student, index) => (
                  <tr key={student.id} className="border-b border-line last:border-0 hover:bg-canvas">
                    <td className="px-4 py-3 font-mono text-xs text-muted">{index + 1}</td>
                    <td className="px-4 py-3 font-medium">{student.name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted">
                      {student.username}
                      <span className="ml-2 tracking-[0.16em]">· {student.kelas || "—"}</span>
                    </td>
                    <td className="px-4 py-3">
                      <form action={changeStudentClass} className="flex items-center gap-2">
                        <input type="hidden" name="studentId" value={student.id} />
                        <select
                          name="kelas"
                          defaultValue={student.kelas}
                          aria-label={`Kelas ${student.name}`}
                          className={inputCompact}
                        >
                          {classes.includes(student.kelas) ? null : (
                            <option value={student.kelas}>
                              {student.kelas || "Belum ada kelas"}
                            </option>
                          )}
                          {classes.map((kelas) => (
                            <option key={kelas} value={kelas}>
                              {kelas}
                            </option>
                          ))}
                        </select>
                        <button type="submit" className={buttonTiny}>
                          Simpan
                        </button>
                      </form>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <DeleteStudentButton studentId={student.id} name={student.name} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {classes.length > 0 ? (
        <Card className="space-y-5">
          <p className={kickerClass}>Ubah nama kelas</p>
          <RenameClassForm classes={classes} />
        </Card>
      ) : null}

      <p className="max-w-2xl text-xs text-muted">
        Menghapus murid juga menghapus riwayat absensi dan sesi loginnya. Pemindahan kelas
        berlaku untuk sesi berikutnya; mengganti nama kelas justru menimpa seluruh sesi lama
        agar rekap tetap nyambung.
      </p>
    </div>
  );
}
