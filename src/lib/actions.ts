"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAuthSession, destroyAuthSession, requireRole } from "./auth";
import { isStatus } from "./format";
import { hashPassword, verifyPassword } from "./password";
import {
  closeSession,
  createAttendanceSession,
  createStudent,
  deleteStudent,
  findSessionByCode,
  findUserByUsername,
  getSession,
  listClasses,
  markAttendance,
  renameClass,
  setStudentClass,
} from "./repo";
import type { FormState } from "./types";

export async function login(_prevState: FormState, formData: FormData): Promise<FormState> {
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!username || !password) {
    return { error: "Username dan password wajib diisi." };
  }

  const user = findUserByUsername(username);
  if (!user || !verifyPassword(password, user.password)) {
    return { error: "Username atau password salah." };
  }

  await createAuthSession(user.id);
  redirect(user.role === "guru" ? "/guru" : "/murid");
}

export async function logout(): Promise<void> {
  await destroyAuthSession();
  redirect("/login");
}

export async function createSession(_prevState: FormState, formData: FormData): Promise<FormState> {
  const user = await requireRole("guru");
  const title = String(formData.get("title") ?? "").trim().slice(0, 80);
  const kelas = String(formData.get("kelas") ?? "").trim().slice(0, 40);

  if (title.length < 3) {
    return { error: "Judul sesi minimal 3 karakter, misalnya \"Matematika · XI IPA 2\"." };
  }
  if (!kelas) {
    return { error: "Pilih kelas yang akan hadir pada sesi ini." };
  }

  const session = createAttendanceSession(title, kelas, user.id);
  revalidatePath("/guru");
  redirect(`/guru/sesi/${session.id}`);
}

export async function joinSession(_prevState: FormState, formData: FormData): Promise<FormState> {
  const user = await requireRole("murid");
  const code = String(formData.get("code") ?? "").trim().toUpperCase();

  if (!code) {
    return { error: "Masukkan kode sesi dari guru." };
  }

  const session = findSessionByCode(code);
  if (!session) {
    return { error: `Kode "${code}" tidak ditemukan. Periksa lagi tulisan guru.` };
  }
  if (session.kelas !== user.kelas) {
    return {
      error: `Kode itu untuk kelas ${session.kelas}. Kamu terdaftar di kelas ${user.kelas || "-"}.`,
    };
  }

  redirect(`/murid/sesi/${session.id}`);
}

export async function submitAttendance(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireRole("murid");
  const sessionId = Number(formData.get("sessionId"));
  const status = formData.get("status");

  if (!Number.isInteger(sessionId)) {
    return { error: "Sesi tidak valid." };
  }
  if (!isStatus(status)) {
    return { error: "Pilih salah satu status kehadiran." };
  }

  const session = getSession(sessionId);
  if (!session) {
    return { error: "Sesi tidak ditemukan." };
  }
  if (session.kelas !== user.kelas) {
    return { error: "Sesi itu bukan untuk kelasmu." };
  }
  if (session.status !== "open") {
    return { error: "Sesi sudah ditutup, absensi tidak bisa diubah lagi." };
  }

  markAttendance(sessionId, user.id, status);
  revalidatePath(`/murid/sesi/${sessionId}`);
  revalidatePath("/murid");

  return { success: `Absensi kamu tercatat: ${status}.` };
}

export async function closeSessionAction(formData: FormData): Promise<void> {
  const user = await requireRole("guru");
  const sessionId = Number(formData.get("sessionId"));

  if (Number.isInteger(sessionId)) {
    closeSession(sessionId, user.id);
    revalidatePath(`/guru/sesi/${sessionId}`);
    revalidatePath("/guru");
  }
}

function refreshStudentPages() {
  revalidatePath("/guru/murid");
  revalidatePath("/guru");
  revalidatePath("/guru/rekap");
}

export async function addStudent(_prevState: FormState, formData: FormData): Promise<FormState> {
  await requireRole("guru");

  const name = String(formData.get("name") ?? "").trim().slice(0, 60);
  const username = String(formData.get("username") ?? "").trim().toLowerCase().slice(0, 32);
  const chosenClass = String(formData.get("kelas") ?? "").trim().slice(0, 40);
  const newClass = String(formData.get("kelasBaru") ?? "").trim().slice(0, 40);
  const givenPassword = String(formData.get("password") ?? "");
  const kelas = newClass || chosenClass;

  if (name.length < 2) return { error: "Nama murid minimal 2 karakter." };
  if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
    return { error: "Username 3–32 karakter: huruf kecil, angka, titik, garis bawah, atau strip." };
  }
  if (!kelas) return { error: "Pilih kelas yang sudah ada, atau tulis kelas baru." };
  if (givenPassword && givenPassword.length < 4) {
    return { error: "Password awal minimal 4 karakter." };
  }
  if (findUserByUsername(username)) return { error: `Username "${username}" sudah dipakai.` };

  createStudent({
    username,
    name,
    kelas,
    password: hashPassword(givenPassword || "murid123"),
  });

  refreshStudentPages();
  return { success: `${name} masuk kelas ${kelas}.` };
}

export async function changeStudentClass(formData: FormData): Promise<void> {
  await requireRole("guru");

  const studentId = Number(formData.get("studentId"));
  const kelas = String(formData.get("kelas") ?? "").trim().slice(0, 40);

  if (Number.isInteger(studentId) && kelas) {
    if (setStudentClass(studentId, kelas) > 0) refreshStudentPages();
  }
}

export async function removeStudent(formData: FormData): Promise<void> {
  await requireRole("guru");

  const studentId = Number(formData.get("studentId"));
  if (Number.isInteger(studentId)) {
    deleteStudent(studentId);
    refreshStudentPages();
  }
}

export async function renameClassAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireRole("guru");

  const from = String(formData.get("renameFrom") ?? "").trim().slice(0, 40);
  const to = String(formData.get("renameTo") ?? "").trim().slice(0, 40);

  if (!from) return { error: "Pilih kelas yang akan diganti namanya." };
  if (to.length < 2) return { error: "Nama kelas baru minimal 2 karakter." };
  if (to === from) return { error: "Nama barunya sama dengan nama lama." };
  if (listClasses().includes(to)) return { error: `Kelas "${to}" sudah ada.` };

  const changed = renameClass(from, to);
  refreshStudentPages();
  revalidatePath("/murid");

  return {
    success: `"${from}" menjadi "${to}" — ${changed.students} murid & ${changed.sessions} sesi ikut berpindah.`,
  };
}
