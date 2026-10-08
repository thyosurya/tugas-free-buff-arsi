/**
 * Regression check: a database created before the `kelas` column existed must be
 * migrated by the app (ensureColumns in src/lib/db.ts) instead of crashing.
 *
 * Usage:
 *   1. stop the server and delete any existing data/ folder
 *   2. node scripts/migration-check.mjs --prepare
 *   3. npm start
 *   4. node scripts/migration-check.mjs
 */
import fs from "node:fs";
import { randomBytes, scryptSync } from "node:crypto";
import Database from "better-sqlite3";
import puppeteer from "puppeteer-core";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const CHROME = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const DB_PATH = "data/absensi.db";

const OLD_SCHEMA = `
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('guru', 'murid')),
  created_at INTEGER NOT NULL
);
CREATE TABLE auth_sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE TABLE sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  teacher_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at INTEGER NOT NULL,
  closed_at INTEGER
);
CREATE TABLE attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('Hadir', 'Izin', 'Sakit', 'Alfa')),
  marked_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (session_id, student_id)
);`;

function prepareFixture() {
  fs.mkdirSync("data", { recursive: true });
  for (const file of fs.readdirSync("data")) fs.rmSync(`data/${file}`);

  const db = new Database(DB_PATH);
  db.exec(OLD_SCHEMA);

  const salt = randomBytes(16).toString("hex");
  const hash = `${salt}:${scryptSync("legacy123", salt, 64).toString("hex")}`;
  const insert = db.prepare(
    "INSERT INTO users (username, password, name, role, created_at) VALUES (?, ?, ?, ?, ?)",
  );
  insert.run("legacy", hash, "Guru Lawas", "guru", Date.now());
  // Murid lama: skema ini belum punya kolom kelas, jadi dia masuk tanpa kelas.
  insert.run("lawas", hash, "Murid Lawas", "murid", Date.now());

  const cols = db.pragma("table_info(users)").map((c) => c.name);
  db.close();
  console.log(`Prepared old-schema fixture at ${DB_PATH}: users(${cols.join(",")})`);
}

if (process.argv.includes("--prepare")) {
  prepareFixture();
  process.exit(0);
}

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  [${detail}]` : ""}`);
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* 1. The old schema must still be in place before the app touches it. */
const before = new Database(DB_PATH, { readonly: true });
const beforeCols = before.pragma("table_info(users)").map((c) => c.name);
before.close();
check("Fixture uses the pre-kelas schema", !beforeCols.includes("kelas"), beforeCols.join(","));

/* 2. Logging in is what runs ensureColumns() through getDb(). */
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox"],
});
const page = await browser.newPage();
let serverError = null;
page.on("response", (r) => {
  if (r.status() >= 500) serverError = `${r.status()} ${r.url()}`;
});

await page.goto(`${BASE}/login`, { waitUntil: "load" });
await page.type('input[name="username"]', "legacy");
await page.type('input[name="password"]', "legacy123");
await page.click('main form button[type="submit"]');

let landed = "";
for (let i = 0; i < 30 && landed === ""; i++) {
  await sleep(300);
  const path = await page.evaluate(() => location.pathname);
  if (path !== "/login") landed = path;
}
const body = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
await browser.close();

check("Login on a migrated database succeeds", landed === "/guru", landed || "still /login");
check("Dashboard renders after migration", body.includes("Sesi absensi"), body.slice(0, 120));
check("No server error during migration", serverError === null, String(serverError));

/* 3. The columns must actually exist now. */
const after = new Database(DB_PATH, { readonly: true });
const afterCols = after.pragma("table_info(users)").map((c) => c.name);
const sessionCols = after.pragma("table_info(sessions)").map((c) => c.name);
after.close();

check("users gained a kelas column", afterCols.includes("kelas"), afterCols.join(","));
check("sessions gained a kelas column", sessionCols.includes("kelas"), sessionCols.join(","));

const backfill = new Database(DB_PATH, { readonly: true });
const legacyMurid = backfill
  .prepare("SELECT kelas FROM users WHERE username = 'lawas'")
  .get();
const orphanCount = backfill
  .prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'murid' AND kelas = ''")
  .get();
backfill.close();
check(
  "Legacy murid was given a usable class",
  legacyMurid?.kelas === "Tanpa kelas",
  String(legacyMurid?.kelas),
);
check("No murid left without a class", orphanCount.n === 0, `sisa=${orphanCount.n}`);

const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
