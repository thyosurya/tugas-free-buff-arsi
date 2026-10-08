"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  addStudent,
  closeSessionAction,
  createSession,
  joinSession,
  login,
  removeStudent,
  renameClassAction,
  submitAttendance,
} from "@/lib/actions";
import { STATUSES, type Status } from "@/lib/format";
import type { FormState } from "@/lib/types";
import { Alert, Field, buttonOutline, buttonSolid, buttonTiny, buttonTinySolid, inputClass } from "./ui";

function SubmitButton({
  children,
  pendingLabel,
  className = buttonSolid,
}: {
  children: React.ReactNode;
  pendingLabel: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? pendingLabel : children}
    </button>
  );
}

/* ------------------------------------------------------------------ */

export function LoginForm() {
  const [state, formAction] = useActionState<FormState, FormData>(login, null);

  return (
    <form action={formAction} className="space-y-4">
      <Field label="Username">
        <input
          name="username"
          autoComplete="username"
          placeholder="guru"
          required
          className={inputClass}
        />
      </Field>
      <Field label="Password">
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••"
          required
          className={inputClass}
        />
      </Field>
      {state?.error ? <Alert kind="error">{state.error}</Alert> : null}
      <SubmitButton pendingLabel="Memeriksa…">Masuk</SubmitButton>
    </form>
  );
}

export function CreateSessionForm({ classes }: { classes: string[] }) {
  const [state, formAction] = useActionState<FormState, FormData>(createSession, null);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="min-w-56 flex-1">
        <Field label="Sesi baru" hint="Isi judul, pilih kelas, lalu bagikan kode-nya ke murid itu.">
          <input
            name="title"
            placeholder="Matematika"
            required
            className={inputClass}
          />
        </Field>
      </div>
      <div className="w-44">
        <Field label="Kelas">
          <select
            name="kelas"
            required
            defaultValue={classes[0] ?? ""}
            className={inputClass}
          >
            {classes.length === 0 ? (
              <option value="">Belum ada murid</option>
            ) : (
              classes.map((kelas) => (
                <option key={kelas} value={kelas}>
                  {kelas}
                </option>
              ))
            )}
          </select>
        </Field>
      </div>
      <SubmitButton pendingLabel="Membuat…" className={buttonSolid}>
        Buat sesi &amp; kode
      </SubmitButton>
      {state?.error ? (
        <div className="w-full">
          <Alert kind="error">{state.error}</Alert>
        </div>
      ) : null}
    </form>
  );
}

export function JoinSessionForm() {
  const [state, formAction] = useActionState<FormState, FormData>(joinSession, null);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="min-w-52 flex-1">
        <Field label="Kode sesi" hint="6 karakter dari guru, contoh: A3K7PD">
          <input
            name="code"
            placeholder="A3K7PD"
            maxLength={6}
            required
            autoComplete="off"
            spellCheck={false}
            className={`${inputClass} font-mono uppercase tracking-[0.3em]`}
          />
        </Field>
      </div>
      <SubmitButton pendingLabel="Mencari…">Gabung</SubmitButton>
      {state?.error ? (
        <div className="w-full">
          <Alert kind="error">{state.error}</Alert>
        </div>
      ) : null}
    </form>
  );
}

export function AttendanceForm({
  sessionId,
  current,
}: {
  sessionId: number;
  current: Status | null;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(submitAttendance, null);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="sessionId" value={sessionId} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {STATUSES.map((status) => {
          const active = current === status;
          return (
            <button
              key={status}
              type="submit"
              name="status"
              value={status}
              aria-pressed={active}
              className={`rounded-md border px-4 py-6 text-left transition-colors ${
                active
                  ? "border-ink bg-ink text-canvas"
                  : "border-line bg-panel text-ink hover:border-ink"
              }`}
            >
              <span className="block font-mono text-[10px] uppercase tracking-[0.18em] opacity-70">
                {active ? "Terpilih" : "Pilih"}
              </span>
              <span className="mt-1 block text-lg font-medium">{status}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingLabel="Menyimpan…">Simpan absensi</SubmitButton>
        <span className="text-xs text-muted">
          Bisa diubah selama sesi masih dibuka.
        </span>
      </div>

      {state?.error ? <Alert kind="error">{state.error}</Alert> : null}
      {state?.success ? <Alert kind="success">{state.success}</Alert> : null}
    </form>
  );
}

export function CloseSessionButton({ sessionId }: { sessionId: number }) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className={buttonOutline}>
        Tutup sesi
      </button>
    );
  }

  return (
    <form
      action={closeSessionAction}
      className="flex flex-wrap items-center gap-3 rounded-md border border-ink px-3 py-2"
    >
      <input type="hidden" name="sessionId" value={sessionId} />
      <span className="text-sm">Tutup sesi sekarang? Murid tidak bisa mengubah absensi.</span>
      <button type="submit" className={buttonSolid}>
        Ya, tutup
      </button>
      <button type="button" onClick={() => setConfirming(false)} className={buttonOutline}>
        Batal
      </button>
    </form>
  );
}

export function AddStudentForm({ classes }: { classes: string[] }) {
  const [state, formAction] = useActionState<FormState, FormData>(addStudent, null);

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      <Field label="Nama lengkap">
        <input name="name" placeholder="Rina Amelia" required className={inputClass} />
      </Field>
      <Field label="Username">
        <input
          name="username"
          placeholder="murid09"
          required
          autoComplete="off"
          spellCheck={false}
          className={inputClass}
        />
      </Field>
      <Field label="Kelas" hint="Pilih kelas yang sudah ada.">
        {/* Tidak memakai required: kelas baru lewat kolom sebelah juga sah. */}
        <select name="kelas" defaultValue={classes[0] ?? ""} className={inputClass}>
          {classes.length === 0 ? (
            <option value="">Belum ada kelas</option>
          ) : (
            classes.map((kelas) => (
              <option key={kelas} value={kelas}>
                {kelas}
              </option>
            ))
          )}
        </select>
      </Field>
      <Field label="Atau kelas baru" hint="Diisi bila kelasnya belum ada.">
        <input name="kelasBaru" placeholder="XI MIPA 1" className={inputClass} />
      </Field>
      <Field label="Password awal" hint="Kosong = murid123.">
        <input
          name="password"
          type="password"
          placeholder="murid123"
          autoComplete="new-password"
          className={inputClass}
        />
      </Field>
      <div className="flex items-end">
        <SubmitButton pendingLabel="Menambahkan…">Tambah murid</SubmitButton>
      </div>
      {state?.error ? (
        <div className="sm:col-span-2">
          <Alert kind="error">{state.error}</Alert>
        </div>
      ) : null}
      {state?.success ? (
        <div className="sm:col-span-2">
          <Alert kind="success">{state.success}</Alert>
        </div>
      ) : null}
    </form>
  );
}

export function RenameClassForm({ classes }: { classes: string[] }) {
  const [state, formAction] = useActionState<FormState, FormData>(renameClassAction, null);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="w-52">
        <Field label="Kelas">
          <select name="renameFrom" defaultValue={classes[0] ?? ""} required className={inputClass}>
            {classes.map((kelas) => (
              <option key={kelas} value={kelas}>
                {kelas}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="min-w-48 flex-1">
        <Field label="Nama baru" hint="Murid dan sesi lama ikut berpindah.">
          <input name="renameTo" placeholder="XI MIPA 1" required className={inputClass} />
        </Field>
      </div>
      <SubmitButton pendingLabel="Mengganti…">Ganti nama</SubmitButton>
      {state?.error ? (
        <div className="w-full">
          <Alert kind="error">{state.error}</Alert>
        </div>
      ) : null}
      {state?.success ? (
        <div className="w-full">
          <Alert kind="success">{state.success}</Alert>
        </div>
      ) : null}
    </form>
  );
}

export function DeleteStudentButton({ studentId, name }: { studentId: number; name: string }) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className={buttonTiny}>
        Hapus
      </button>
    );
  }

  return (
    <form
      action={removeStudent}
      className="flex flex-wrap items-center gap-2 rounded-md border border-ink px-2 py-1.5"
    >
      <input type="hidden" name="studentId" value={studentId} />
      <span className="text-xs">Hapus {name} beserta riwayat absensinya?</span>
      <button type="submit" className={buttonTinySolid}>
        Ya, hapus
      </button>
      <button type="button" onClick={() => setConfirming(false)} className={buttonTiny}>
        Batal
      </button>
    </form>
  );
}

export function CopyButton({ value, className = buttonOutline }: { value: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button type="button" onClick={copy} className={className}>
      {copied ? "Tersalin" : "Salin kode"}
    </button>
  );
}

export { SubmitButton };
