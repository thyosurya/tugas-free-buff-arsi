import type { Metadata } from "next";
import { Card, kickerClass } from "@/components/ui";
import { LoginForm } from "@/components/forms";

export const metadata: Metadata = {
  title: "Masuk",
};

const DEMO = [
  { role: "Guru", username: "guru", password: "guru123", kelas: "—" },
  { role: "Murid", username: "murid01", password: "murid123", kelas: "XI IPA 2" },
  { role: "Murid", username: "murid05", password: "murid123", kelas: "XI IPS 1" },
];

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-5 py-14">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.4em]">Absensi</p>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">Masuk ke kelas</h1>
          <p className="mt-1.5 text-sm text-muted">
            Satu akun untuk guru, satu akun untuk murid.
          </p>
        </div>

        <Card>
          <LoginForm />
        </Card>

        <div className="mt-6 rounded-lg border border-dashed border-line p-4">
          <p className={kickerClass}>Akun demo</p>
          <ul className="mt-3 space-y-1.5 font-mono text-xs">
            {DEMO.map((item) => (
              <li key={item.username} className="flex justify-between gap-4">
                <span className="text-muted">
                  {item.role} · {item.kelas}
                </span>
                <span>
                  {item.username} / {item.password}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted">
            Murid lain: <span className="font-mono">murid02</span>–
            <span className="font-mono">murid04</span> (XI IPA 2) dan{" "}
            <span className="font-mono">murid06</span>–{" "}
            <span className="font-mono">murid08</span> (XI IPS 1), password sama.
          </p>
        </div>
      </div>
    </main>
  );
}
