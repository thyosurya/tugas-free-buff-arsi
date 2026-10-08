import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import type { Database as Sqlite } from "better-sqlite3";
import { hashPassword } from "./password";
import type { Status } from "./format";

export type Role = "guru" | "murid";

export interface UserRow {
  id: number;
  username: string;
  password: string;
  name: string;
  role: Role;
  kelas: string;
  created_at: number;
}

export interface AuthSessionRow {
  token: string;
  user_id: number;
  created_at: number;
  expires_at: number;
}

export interface SessionRow {
  id: number;
  code: string;
  title: string;
  teacher_id: number;
  kelas: string;
  status: "open" | "closed";
  created_at: number;
  closed_at: number | null;
}

export interface AttendanceRow {
  id: number;
  session_id: number;
  student_id: number;
  status: Status;
  marked_at: number;
  updated_at: number;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  username   TEXT NOT NULL UNIQUE,
  password   TEXT NOT NULL,
  name       TEXT NOT NULL,
  role       TEXT NOT NULL CHECK (role IN ('guru', 'murid')),
  kelas      TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  token      TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  code       TEXT NOT NULL UNIQUE,
  title      TEXT NOT NULL,
  teacher_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kelas      TEXT NOT NULL DEFAULT '',
  status     TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at INTEGER NOT NULL,
  closed_at  INTEGER
);

CREATE TABLE IF NOT EXISTS attendance (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status     TEXT NOT NULL CHECK (status IN ('Hadir', 'Izin', 'Sakit', 'Alfa')),
  marked_at  INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (session_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_session ON attendance(session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance(student_id);
`;

const SEED_USERS: Array<Omit<UserRow, "id" | "created_at">> = [
  { username: "guru", password: "guru123", name: "Sari Handayani, S.Pd", role: "guru", kelas: "" },
  { username: "murid01", password: "murid123", name: "Aditya Nugroho", role: "murid", kelas: "XI IPA 2" },
  { username: "murid02", password: "murid123", name: "Bella Pratiwi", role: "murid", kelas: "XI IPA 2" },
  { username: "murid03", password: "murid123", name: "Citra Lestari", role: "murid", kelas: "XI IPA 2" },
  { username: "murid04", password: "murid123", name: "Dimas Ramadhan", role: "murid", kelas: "XI IPA 2" },
  { username: "murid05", password: "murid123", name: "Eka Wulandari", role: "murid", kelas: "XI IPS 1" },
  { username: "murid06", password: "murid123", name: "Fajar Pratama", role: "murid", kelas: "XI IPS 1" },
  { username: "murid07", password: "murid123", name: "Gita Maharani", role: "murid", kelas: "XI IPS 1" },
  { username: "murid08", password: "murid123", name: "Hafiz Maulana", role: "murid", kelas: "XI IPS 1" },
];

function seed(db: Sqlite) {
  const count = (db.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number }).n;
  if (count > 0) return;

  const insert = db.prepare(
    "INSERT INTO users (username, password, name, role, kelas, created_at) VALUES (?, ?, ?, ?, ?, ?)",
  );
  const now = Date.now();
  const run = db.transaction(() => {
    for (const user of SEED_USERS) {
      insert.run(user.username, hashPassword(user.password), user.name, user.role, user.kelas, now);
    }
  });
  run();
}

/** Adds columns introduced after a database was first created. */
function ensureColumns(db: Sqlite) {
  const columnsOf = (table: string) =>
    new Set((db.pragma(`table_info(${table})`) as Array<{ name: string }>).map((c) => c.name));

  if (!columnsOf("users").has("kelas")) {
    db.exec("ALTER TABLE users ADD COLUMN kelas TEXT NOT NULL DEFAULT ''");
  }
  if (!columnsOf("sessions").has("kelas")) {
    db.exec("ALTER TABLE sessions ADD COLUMN kelas TEXT NOT NULL DEFAULT ''");
  }

  // Murid dari database lama belum punya kelas. Beri satu wadah eksplisit agar
  // mereka tetap bisa diabsen, lalu guru bisa memindahkannya lewat /guru/murid.
  db.exec("UPDATE users SET kelas = 'Tanpa kelas' WHERE role = 'murid' AND kelas = ''");
}

function createDatabase(): Sqlite {
  const dataDir = path.join(process.cwd(), "data");
  fs.mkdirSync(dataDir, { recursive: true });

  const db = new Database(path.join(dataDir, "absensi.db"));
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  ensureColumns(db);
  seed(db);
  return db;
}

declare global {
  var __absensiDb: Sqlite | undefined;
}

export function getDb(): Sqlite {
  if (!globalThis.__absensiDb) {
    globalThis.__absensiDb = createDatabase();
  }
  return globalThis.__absensiDb;
}
