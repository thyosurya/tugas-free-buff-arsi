import { getDb, type SessionRow, type UserRow } from "./db";
import type { Status } from "./format";

export interface SessionListItem extends SessionRow {
  teacher_name: string;
  marked: number;
  total_students: number;
}

export interface StudentSessionRow extends SessionRow {
  teacher_name: string;
  my_status: Status | null;
  my_marked_at: number | null;
}

export interface RosterEntry {
  id: number;
  name: string;
  username: string;
  status: Status | null;
  marked_at: number | null;
}

export interface SessionStats {
  hadir: number;
  izin: number;
  sakit: number;
  alfa: number;
  marked: number;
}

export interface StudentStats extends SessionStats {
  total_sesi: number;
  belum: number;
}

export interface RecapRow {
  id: number;
  name: string;
  username: string;
  kelas: string;
  total_sesi: number;
  sudah: number;
  hadir: number;
  izin: number;
  sakit: number;
  alfa: number;
}

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;

function generateCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

export function findUserByUsername(username: string): UserRow | undefined {
  return getDb().prepare("SELECT * FROM users WHERE username = ?").get(username) as
    | UserRow
    | undefined;
}

/** Kelas yang punya murid — dipakai sebagai pilihan saat membuat sesi. */
export function listClasses(): string[] {
  const rows = getDb()
    .prepare(
      "SELECT DISTINCT kelas FROM users WHERE role = 'murid' AND kelas <> '' ORDER BY kelas",
    )
    .all() as Array<{ kelas: string }>;
  return rows.map((row) => row.kelas);
}

export function listStudents(): UserRow[] {
  return getDb()
    .prepare("SELECT * FROM users WHERE role = 'murid' ORDER BY kelas, name")
    .all() as UserRow[];
}

export function countStudents(): number {
  return (getDb().prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'murid'").get() as {
    n: number;
  }).n;
}

export function createStudent(input: {
  username: string;
  name: string;
  kelas: string;
  password: string;
}): void {
  getDb()
    .prepare(
      "INSERT INTO users (username, password, name, role, kelas, created_at) VALUES (?, ?, ?, 'murid', ?, ?)",
    )
    .run(input.username, input.password, input.name, input.kelas, Date.now());
}

export function setStudentClass(studentId: number, kelas: string): number {
  return getDb()
    .prepare("UPDATE users SET kelas = ? WHERE id = ? AND role = 'murid'")
    .run(kelas, studentId).changes;
}

/** Menghapus murid beserta riwayat absensi & sesi login-nya (ON DELETE CASCADE). */
export function deleteStudent(studentId: number): number {
  return getDb().prepare("DELETE FROM users WHERE id = ? AND role = 'murid'").run(studentId)
    .changes;
}

/** Ganti nama kelas: murid dan sesi lama ikut berpindah agar rekap tetap konsisten. */
export function renameClass(from: string, to: string): { students: number; sessions: number } {
  const db = getDb();
  const run = db.transaction(() => ({
    students: db
      .prepare("UPDATE users SET kelas = ? WHERE kelas = ? AND role = 'murid'")
      .run(to, from).changes,
    sessions: db.prepare("UPDATE sessions SET kelas = ? WHERE kelas = ?").run(to, from).changes,
  }));
  return run();
}

export function getSession(id: number): SessionRow | undefined {
  return getDb().prepare("SELECT * FROM sessions WHERE id = ?").get(id) as SessionRow | undefined;
}

export function getSessionWithTeacher(
  sessionId: number,
): (SessionRow & { teacher_name: string }) | undefined {
  const sql = `
    SELECT s.*, t.name AS teacher_name
    FROM sessions s
    JOIN users t ON t.id = s.teacher_id
    WHERE s.id = ?`;

  return getDb().prepare(sql).get(sessionId) as
    | (SessionRow & { teacher_name: string })
    | undefined;
}

export function findSessionByCode(code: string): SessionRow | undefined {
  return getDb().prepare("SELECT * FROM sessions WHERE code = ?").get(code) as
    | SessionRow
    | undefined;
}

export function createAttendanceSession(
  title: string,
  kelas: string,
  teacherId: number,
): SessionRow {
  const db = getDb();
  const insert = db.prepare(
    "INSERT INTO sessions (code, title, kelas, teacher_id, status, created_at) VALUES (?, ?, ?, ?, 'open', ?)",
  );

  const run = db.transaction(() => {
    let code = generateCode();
    while (db.prepare("SELECT 1 FROM sessions WHERE code = ?").get(code)) {
      code = generateCode();
    }
    const result = insert.run(code, title, kelas, teacherId, Date.now());
    return Number(result.lastInsertRowid);
  });

  return getSession(run())!;
}

export function closeSession(sessionId: number, teacherId: number): void {
  getDb()
    .prepare(
      "UPDATE sessions SET status = 'closed', closed_at = ? WHERE id = ? AND teacher_id = ? AND status = 'open'",
    )
    .run(Date.now(), sessionId, teacherId);
}

export function markAttendance(sessionId: number, studentId: number, status: Status): void {
  const now = Date.now();
  getDb()
    .prepare(
      `INSERT INTO attendance (session_id, student_id, status, marked_at, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(session_id, student_id)
       DO UPDATE SET status = excluded.status, updated_at = excluded.updated_at`,
    )
    .run(sessionId, studentId, status, now, now);
}

export function getStudentStatus(sessionId: number, studentId: number): Status | null {
  const row = getDb()
    .prepare("SELECT status FROM attendance WHERE session_id = ? AND student_id = ?")
    .get(sessionId, studentId) as { status: Status } | undefined;
  return row?.status ?? null;
}

export function listTeacherSessions(teacherId: number, kelas?: string): SessionListItem[] {
  const classFilter = kelas ? "AND s.kelas = ?" : "";
  const sql = `
    SELECT s.*,
           t.name AS teacher_name,
           (SELECT COUNT(*) FROM users WHERE role = 'murid' AND kelas = s.kelas) AS total_students,
           (SELECT COUNT(*) FROM attendance WHERE session_id = s.id) AS marked
    FROM sessions s
    JOIN users t ON t.id = s.teacher_id
    WHERE s.teacher_id = ? ${classFilter}
    ORDER BY s.created_at DESC`;

  const params = kelas ? [teacherId, kelas] : [teacherId];
  return getDb().prepare(sql).all(...params) as SessionListItem[];
}

export function listSessionsForStudent(studentId: number, kelas: string): StudentSessionRow[] {
  const sql = `
    SELECT s.*,
           t.name AS teacher_name,
           a.status AS my_status,
           a.marked_at AS my_marked_at
    FROM sessions s
    JOIN users t ON t.id = s.teacher_id
    LEFT JOIN attendance a ON a.session_id = s.id AND a.student_id = ?
    WHERE s.kelas = ?
    ORDER BY s.created_at DESC`;

  return getDb().prepare(sql).all(studentId, kelas) as StudentSessionRow[];
}

/** Hanya murid sekelas dengan sesi tersebut yang boleh terlihat. */
export function getRoster(sessionId: number, kelas: string): RosterEntry[] {
  const sql = `
    SELECT u.id, u.name, u.username, a.status, a.marked_at
    FROM users u
    LEFT JOIN attendance a ON a.student_id = u.id AND a.session_id = ?
    WHERE u.role = 'murid' AND u.kelas = ?
    ORDER BY u.name`;

  return getDb().prepare(sql).all(sessionId, kelas) as RosterEntry[];
}

export function getSessionStats(sessionId: number): SessionStats {
  const sql = `
    SELECT
      COALESCE(SUM(CASE WHEN status = 'Hadir' THEN 1 ELSE 0 END), 0) AS hadir,
      COALESCE(SUM(CASE WHEN status = 'Izin'  THEN 1 ELSE 0 END), 0) AS izin,
      COALESCE(SUM(CASE WHEN status = 'Sakit' THEN 1 ELSE 0 END), 0) AS sakit,
      COALESCE(SUM(CASE WHEN status = 'Alfa'  THEN 1 ELSE 0 END), 0) AS alfa,
      COUNT(*) AS marked
    FROM attendance
    WHERE session_id = ?`;

  return getDb().prepare(sql).get(sessionId) as SessionStats;
}

export function getStudentStats(studentId: number, kelas: string): StudentStats {
  const attendanceSql = `
    SELECT
      COALESCE(SUM(CASE WHEN status = 'Hadir' THEN 1 ELSE 0 END), 0) AS hadir,
      COALESCE(SUM(CASE WHEN status = 'Izin'  THEN 1 ELSE 0 END), 0) AS izin,
      COALESCE(SUM(CASE WHEN status = 'Sakit' THEN 1 ELSE 0 END), 0) AS sakit,
      COALESCE(SUM(CASE WHEN status = 'Alfa'  THEN 1 ELSE 0 END), 0) AS alfa,
      COUNT(*) AS marked
    FROM attendance
    WHERE student_id = ?`;

  const db = getDb();
  const attendance = db.prepare(attendanceSql).get(studentId) as SessionStats;
  const sessions = db
    .prepare("SELECT COUNT(*) AS total_sesi FROM sessions WHERE kelas = ?")
    .get(kelas) as { total_sesi: number };

  return {
    ...attendance,
    total_sesi: sessions.total_sesi,
    belum: Math.max(sessions.total_sesi - attendance.marked, 0),
  };
}

export function getRecap(teacherId: number, kelas?: string): RecapRow[] {
  const sessionFilter = kelas ? " AND kelas = ?" : "";
  const studentFilter = kelas ? " AND u.kelas = ?" : "";

  const sql = `
    SELECT u.id, u.name, u.username, u.kelas,
           (SELECT COUNT(*) FROM sessions WHERE teacher_id = ?${sessionFilter}) AS total_sesi,
           COUNT(a.id) AS sudah,
           COALESCE(SUM(CASE WHEN a.status = 'Hadir' THEN 1 ELSE 0 END), 0) AS hadir,
           COALESCE(SUM(CASE WHEN a.status = 'Izin'  THEN 1 ELSE 0 END), 0) AS izin,
           COALESCE(SUM(CASE WHEN a.status = 'Sakit' THEN 1 ELSE 0 END), 0) AS sakit,
           COALESCE(SUM(CASE WHEN a.status = 'Alfa'  THEN 1 ELSE 0 END), 0) AS alfa
    FROM users u
    LEFT JOIN attendance a
           ON a.student_id = u.id
          AND a.session_id IN (SELECT id FROM sessions WHERE teacher_id = ?${sessionFilter})
    WHERE u.role = 'murid'${studentFilter}
    GROUP BY u.id
    ORDER BY u.kelas, u.name`;

  const teacherScope = kelas ? [teacherId, kelas] : [teacherId];
  const params = [...teacherScope, ...teacherScope, ...(kelas ? [kelas] : [])];

  return getDb().prepare(sql).all(...params) as RecapRow[];
}
