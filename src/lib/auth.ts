import { randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb, type Role } from "./db";

const COOKIE_NAME = "absensi_token";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface SessionUser {
  id: number;
  username: string;
  name: string;
  role: Role;
  /** Kelas murid; kosong untuk guru. */
  kelas: string;
}

export async function createAuthSession(userId: number): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const now = Date.now();

  getDb()
    .prepare("INSERT INTO auth_sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)")
    .run(token, userId, now, now + SESSION_TTL_MS);

  const jar = await cookies();
  const proto = (await headers()).get("x-forwarded-proto");

  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    // Hanya tandai Secure bila memang dijangkau lewat HTTPS, supaya login tetap
    // jalan saat demo lokal (http://localhost maupun lewat IP jaringan).
    secure: proto === "https",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
}

export async function destroyAuthSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;

  if (token) {
    getDb().prepare("DELETE FROM auth_sessions WHERE token = ?").run(token);
    jar.delete(COOKIE_NAME);
  }
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const db = getDb();
  const row = db
    .prepare(
      `SELECT u.id, u.username, u.name, u.role, u.kelas, s.expires_at
       FROM auth_sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token = ?`,
    )
    .get(token) as (SessionUser & { expires_at: number }) | undefined;

  if (!row) return null;

  if (row.expires_at <= Date.now()) {
    db.prepare("DELETE FROM auth_sessions WHERE token = ?").run(token);
    return null;
  }

  return { id: row.id, username: row.username, name: row.name, role: row.role, kelas: row.kelas };
}

/** Guards a page or action: redirects to /login when logged out, or to the
 *  caller's own dashboard when the logged-in actor is the wrong one. */
export async function requireRole(role: Role): Promise<SessionUser> {
  const user = await getSessionUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role !== role) {
    redirect(user.role === "guru" ? "/guru" : "/murid");
  }

  return user;
}
