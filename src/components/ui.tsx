import Link from "next/link";
import type { ReactNode } from "react";
import type { Status } from "@/lib/format";

/* ------------------------------------------------------------------ *
 * Shared class strings — one visual language, zero decorative noise.
 * ------------------------------------------------------------------ */

export const buttonSolid =
  "inline-flex items-center justify-center gap-2 rounded-md border border-ink bg-ink px-4 py-2 text-sm font-medium text-canvas transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40";

export const buttonOutline =
  "inline-flex items-center justify-center gap-2 rounded-md border border-line bg-transparent px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-ink disabled:cursor-not-allowed disabled:opacity-40";

export const buttonTiny =
  "inline-flex items-center justify-center rounded-md border border-line px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-ink transition-colors hover:border-ink";

export const buttonTinySolid =
  "inline-flex items-center justify-center rounded-md border border-ink bg-ink px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-canvas transition-opacity hover:opacity-80";

export const inputClass =
  "w-full rounded-md border border-line bg-canvas px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-muted focus:border-ink";

/** Versi padat untuk select di dalam baris tabel. */
export const inputCompact =
  "w-full max-w-44 rounded-md border border-line bg-canvas px-2 py-1 text-xs text-ink outline-none transition-colors focus:border-ink";

export const labelClass =
  "mb-1.5 block font-mono text-[10px] uppercase tracking-[0.18em] text-muted";

export const kickerClass = "font-mono text-[10px] uppercase tracking-[0.22em] text-muted";

/* ------------------------------------------------------------------ */

export function Button({
  children,
  variant = "solid",
  className = "",
  type = "button",
  disabled,
  onClick,
}: {
  children: ReactNode;
  variant?: "solid" | "outline";
  className?: string;
  type?: "button" | "submit";
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`${variant === "solid" ? buttonSolid : buttonOutline} ${className}`}
    >
      {children}
    </button>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-line bg-panel p-6 ${className}`}>{children}</section>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      {/*
        <label> membungkus kontrol supaya input punya nama aksesibel tanpa JS.
        Teks labelnya di <span> sendiri agar kelas huruf kecil/tracking tidak
        ikut mewarisi ke dalam input.
      */}
      <label className="block">
        <span className={labelClass}>{label}</span>
        {children}
      </label>
      {hint ? <p className="mt-1.5 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export function Alert({ kind, children }: { kind: "error" | "success"; children: ReactNode }) {
  return (
    <p
      role={kind === "error" ? "alert" : "status"}
      className={`rounded-md border px-3 py-2 text-sm ${
        kind === "error"
          ? "border-ink bg-ink/5 text-ink"
          : "border-dashed border-ink/50 text-ink"
      }`}
    >
      {children}
    </p>
  );
}

export function PageHeader({
  kicker,
  title,
  description,
  action,
}: {
  kicker: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6">
      <div className="space-y-2">
        <p className={kickerClass}>{kicker}</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {description ? <p className="max-w-xl text-sm text-muted">{description}</p> : null}
      </div>
      {action}
    </header>
  );
}

export function SectionTitle({ children, meta }: { children: ReactNode; meta?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <h2 className={kickerClass}>{children}</h2>
      {meta ? <span className="font-mono text-[11px] text-muted">{meta}</span> : null}
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-lg border border-dashed border-line px-6 py-12 text-center">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">Kosong</p>
      <p className="mt-3 text-sm font-medium">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-xs text-muted">{description}</p>
    </div>
  );
}

/** Filter kelas berupa chip link, dipakai di dasbor guru dan rekap. */
export function ClassFilter({
  base,
  classes,
  active,
}: {
  base: string;
  classes: string[];
  active?: string;
}) {
  const chip = (on: boolean) =>
    `rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors ${
      on ? "border-ink bg-ink text-canvas" : "border-line text-muted hover:border-ink hover:text-ink"
    }`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link href={base} className={chip(!active)}>
        Semua
      </Link>
      {classes.map((kelas) => (
        <Link
          key={kelas}
          href={`${base}?kelas=${encodeURIComponent(kelas)}`}
          className={chip(active === kelas)}
        >
          {kelas}
        </Link>
      ))}
    </div>
  );
}

export function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-line bg-panel px-4 py-3">
      <p className={kickerClass}>{label}</p>
      <p className="mt-1 font-mono text-2xl font-medium tracking-tight">{value}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Status chips — monochrome, differentiated by fill + border style.
 * ------------------------------------------------------------------ */

const statusStyles: Record<Status, string> = {
  Hadir: "border-ink bg-ink text-canvas",
  Izin: "border-ink/45 bg-transparent text-ink",
  Sakit: "border-ink/45 bg-ink/10 text-ink",
  Alfa: "border-dashed border-ink/60 bg-transparent text-ink",
};

export function StatusBadge({ status }: { status: Status | null }) {
  if (!status) {
    return (
      <span className="inline-flex items-center rounded-full border border-dashed border-line px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
        Belum absen
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] ${statusStyles[status]}`}
    >
      {status}
    </span>
  );
}

export function SessionBadge({ status }: { status: "open" | "closed" }) {
  const open = status === "open";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] ${
        open ? "border-ink bg-ink text-canvas" : "border-line text-muted"
      }`}
    >
      {open ? "Dibuka" : "Ditutup"}
    </span>
  );
}
