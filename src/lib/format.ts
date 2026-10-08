export const STATUSES = ["Hadir", "Izin", "Sakit", "Alfa"] as const;

export type Status = (typeof STATUSES)[number];

export function isStatus(value: unknown): value is Status {
  return typeof value === "string" && (STATUSES as readonly string[]).includes(value);
}

export function formatDateTime(ms: number): string {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(ms),
  );
}

export function formatDate(ms: number): string {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(new Date(ms));
}

export function formatTime(ms: number): string {
  return new Intl.DateTimeFormat("id-ID", { timeStyle: "short" }).format(new Date(ms));
}

export function percent(part: number, total: number): string {
  if (!total) return "0%";
  return `${Math.round((part / total) * 100)}%`;
}
