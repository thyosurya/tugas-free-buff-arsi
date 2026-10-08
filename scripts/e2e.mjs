import puppeteer from "puppeteer-core";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const CHROME =
  process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  [${detail}]` : ""}`);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitFor(fn, { timeout = 15000, step = 150, label = "condition" } = {}) {
  const start = Date.now();
  let last;
  while (Date.now() - start < timeout) {
    try {
      const value = await fn();
      if (value) return value;
      last = value;
    } catch (err) {
      last = err.message;
    }
    await sleep(step);
  }
  throw new Error(`Timeout waiting for ${label} (last=${String(last)})`);
}

const text = (page, selector) =>
  page.$eval(selector, (el) => el.textContent.trim()).catch(() => null);

/** Form controls with no programmatic accessible name (label/aria-label). */
async function unlabeledControls(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll("input:not([type=hidden]), select, textarea")]
      .filter((el) => !el.closest("label") && !el.getAttribute("aria-label"))
      .map((el) => el.name || el.type || el.tagName.toLowerCase()),
  );
}

async function login(page, username, password) {
  await page.goto(`${BASE}/login`, { waitUntil: "load" });
  await page.waitForSelector('input[name="username"]');
  await page.type('input[name="username"]', username);
  await page.type('input[name="password"]', password);
  await page.click('main form button[type="submit"]');
    await waitFor(() => page.evaluate(() => location.pathname !== "/login"), {
      label: "redirect after login",
    });
  return page.evaluate(() => location.pathname);
}

/** Reads the status badge text from the roster row that contains `username`. */
async function rosterStatus(page, username) {
  return page.evaluate((u) => {
    const rows = [...document.querySelectorAll("tbody tr")];
    const row = rows.find((tr) => tr.textContent.includes(u));
    if (!row) return null;
    const cells = [...row.querySelectorAll("td")];
    return cells[3] ? cells[3].textContent.trim() : null;
  }, username);
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

try {
  /* ---------------------------------------------------------------- *
   * 1. Auth guard: anonymous visitor is sent to /login
   * ---------------------------------------------------------------- */
  const anonCtx = await browser.createBrowserContext();
  const anon = await anonCtx.newPage();
  await anon.goto(`${BASE}/guru`, { waitUntil: "load" });
  await waitFor(() => anon.evaluate(() => location.pathname === "/login"), {
    label: "anonymous redirect",
  }  ).then(
    () => check("Anonymous /guru redirects to /login", true),
    (e) => check("Anonymous /guru redirects to /login", false, e.message),
  );

  const unlabeledLogin = await unlabeledControls(anon);
  check("Login inputs carry an accessible name", unlabeledLogin.length === 0, JSON.stringify(unlabeledLogin));

  /* HTTP-level redirect must work for clients that have no JavaScript at all */
  const anonHttp = [];
  for (const path of ["/", "/guru", "/murid", "/guru/murid"]) {
    const res = await fetch(`${BASE}${path}`, {
      redirect: "manual",
      headers: { Accept: "text/html" },
    });
    anonHttp.push({ path, status: res.status, location: res.headers.get("location") });
  }
  check(
    "Protected routes answer 307 -> /login without JavaScript",
    anonHttp.every((r) => r.status === 307 && r.location === "/login"),
    anonHttp.map((r) => `${r.path}:${r.status}`).join(" "),
  );

  /* ---------------------------------------------------------------- *
   * 2. Guru: login, create a session, capture the class code
   * ---------------------------------------------------------------- */
  const guruCtx = await browser.createBrowserContext();
  const guru = await guruCtx.newPage();

  const guruLanding = await login(guru, "guru", "guru123").catch((e) => {
    check("Guru login", false, e.message);
    return "";
  });
  check("Guru login lands on /guru", guruLanding === "/guru", guruLanding);

  await guru.waitForSelector('input[name="title"]');
  const unlabeledGuru = await unlabeledControls(guru);
  check("Guru dashboard inputs are labelled", unlabeledGuru.length === 0, JSON.stringify(unlabeledGuru));
  const title = `Matematika E2E ${Date.now() % 100000}`;
  await guru.type('input[name="title"]', title);
  await Promise.all([
    waitFor(
      () => guru.evaluate(() => /^\/guru\/sesi\/\d+$/.test(location.pathname)),
      { label: "navigate to new session" },
    ),
    guru.click('main form button[type="submit"]'),
  ]);
  await guru.waitForSelector('[data-testid="session-code"]');
  const code = await text(guru, '[data-testid="session-code"]');
  const sessionUrl = await guru.evaluate(() => location.pathname);
  const sessionId = sessionUrl.split("/").pop();
  const muridSessionUrl = `/murid/sesi/${sessionId}`;
  check("Guru creates a session and gets a 6-char code", /^[A-Z0-9]{6}$/.test(code || ""), `${code}`);
  const kelasOnPage = await guru.evaluate(() => document.body.innerText.includes("XI IPA 2"));
  check("Session is created for the class picked in the form", kelasOnPage);

  /* ---------------------------------------------------------------- *
   * 3. Murid: login, join by code, mark Hadir
   * ---------------------------------------------------------------- */
  const muridCtx = await browser.createBrowserContext();
  const murid = await muridCtx.newPage();

  const muridLanding = await login(murid, "murid01", "murid123").catch((e) => {
    check("Murid login", false, e.message);
    return "";
  });
  check("Murid login lands on /murid", muridLanding === "/murid", muridLanding);
  const muridHasRows = await murid
    .waitForSelector("tbody tr")
    .then(() => true)
    .catch(() => false);
  check("Murid dashboard shows riwayat sesi", muridHasRows);

  await murid.waitForSelector('input[name="code"]');
  const unlabeledMurid = await unlabeledControls(murid);
  check("Murid join form is labelled", unlabeledMurid.length === 0, JSON.stringify(unlabeledMurid));
  await murid.type('input[name="code"]', code);
  await Promise.all([
    waitFor(
      () => murid.evaluate(() => /^\/murid\/sesi\/\d+$/.test(location.pathname)),
      { label: "join by code" },
    ),
    murid.click('main form button[type="submit"]'),
  ]);
  check("Joining with the class code opens the session", true);

  await murid.waitForSelector('button[name="status"][value="Hadir"]');
  await murid.click('button[name="status"][value="Hadir"]');
  await murid.waitForSelector('button[name="status"][value="Izin"]');
  const saved = await waitFor(
    async () => {
      const t = await murid.evaluate(() => document.body.innerText);
      return t.includes("Absensi kamu tercatat: Hadir.") ? t : null;
    },
    { label: "attendance confirmation" },
  ).catch(() => null);
  check("Marking Hadir shows a confirmation", Boolean(saved));

  const pressed = await murid.$eval(
    'button[name="status"][value="Hadir"]',
    (el) => el.getAttribute("aria-pressed"),
  );
  check("Hadir tile is highlighted as selected", pressed === "true", String(pressed));

  /* ---------------------------------------------------------------- *
   * 4. Murid can change their answer while the session is open
   * ---------------------------------------------------------------- */
  await murid.click('button[name="status"][value="Sakit"]');
  const changed = await waitFor(
    async () => {
      const t = await murid.evaluate(() => document.body.innerText);
      return t.includes("Absensi kamu tercatat: Sakit.") ? t : null;
    },
    { label: "attendance change" },
  ).catch(() => null);
  check("Murid can change status before the session closes", Boolean(changed));

  /* ---------------------------------------------------------------- *
   * 5. Murid history reflects the recorded status
   * ---------------------------------------------------------------- */
  await murid.goto(`${BASE}/murid`, { waitUntil: "load" });
  await murid.waitForSelector("tbody tr");
  const historyStatus = await murid.evaluate((t) => {
    const row = [...document.querySelectorAll("tbody tr")].find((tr) =>
      tr.textContent.includes(t),
    );
    return row ? row.textContent : null;
  }, title);
  check("Riwayat murid shows the session with a status", /Sakit/.test(historyStatus || ""), (historyStatus || "").slice(0, 80));

  /* ---------------------------------------------------------------- *
   * 5b. Class isolation: another class may not use this code
   * ---------------------------------------------------------------- */
  const otherCtx = await browser.createBrowserContext();
  const other = await otherCtx.newPage();
  const otherLanding = await login(other, "murid05", "murid123").catch((e) => {
    check("Murid05 (other class) logs in", false, e.message);
    return "";
  });
  check("Murid05 (other class) logs in", otherLanding === "/murid", otherLanding);

  const hiddenFromOther = await waitFor(
    async () => {
      const has = await other.evaluate((t) => document.body.innerText.includes(t), title);
      return has === false;
    },
    { label: "session hidden from other class" },
  ).catch(() => false);
  check("Session of another class is hidden from murid05", hiddenFromOther);

  await other.waitForSelector('input[name="code"]');
  await other.type('input[name="code"]', code);
  await other.click('main form button[type="submit"]');
  const rejection = await waitFor(
    async () => {
      const t = await other.evaluate(() => document.body.innerText);
      return t.includes("Kode itu untuk kelas") ? t : null;
    },
    { label: "cross-class rejection" },
  ).catch(() => null);
  check("Cross-class code is rejected with a clear message", Boolean(rejection),
    (rejection || "").match(/Kode itu untuk kelas[^.]*\./)?.[0] || "not found");
  const otherPath = await other.evaluate(() => location.pathname);
  check("Murid05 never reaches the foreign session", !/^\/murid\/sesi\//.test(otherPath), otherPath);

  /* ---------------------------------------------------------------- *
   * 6. Guru sees the recorded status in the roster
   * ---------------------------------------------------------------- */
  await guru.goto(`${BASE}${sessionUrl}`, { waitUntil: "load" });
  await guru.waitForSelector("tbody tr");
  const seen = await rosterStatus(guru, "murid01");
  check("Guru roster shows murid01 as Sakit", seen === "Sakit", String(seen));

  const rosterInfo = await guru.evaluate(() => ({
    rows: document.querySelectorAll("tbody tr").length,
    hasOtherClass: document.body.innerText.includes("Eka Wulandari"),
  }));
  check(
    "Roster lists only the session's class (4 murid)",
    rosterInfo.rows === 4 && !rosterInfo.hasOtherClass,
    JSON.stringify(rosterInfo),
  );

  /* ---------------------------------------------------------------- *
   * 7. Guru closes the session (two-step confirm)
   * ---------------------------------------------------------------- */
  const closeBtn = await guru.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find(
      (b) => b.textContent.trim() === "Tutup sesi",
    );
    if (!btn) return false;
    btn.click();
    return true;
  });
  check("Close-session confirmation appears", closeBtn);
  await guru.waitForSelector('main form button[type="submit"]');
  await guru.evaluate(() => {
    const btn = [...document.querySelectorAll('main form button[type="submit"]')].find((b) =>
      b.textContent.includes("Ya, tutup"),
    );
    btn?.click();
  });
  await waitFor(async () => ((await text(guru, "body")) || "").includes("Ditutup"), {
    label: "session closed badge",
  });
  check("Guru closes the session", true);

  /* ---------------------------------------------------------------- *
   * 8. Closing the session locks the student form
   * ---------------------------------------------------------------- */
  await murid.goto(`${BASE}${muridSessionUrl}`, { waitUntil: "load" });
  await sleep(1200);
  const muridAfterClose = await murid.evaluate(() => ({
    path: location.pathname,
    text: document.body.innerText.replace(/\s+/g, " ").slice(0, 700),
  }));
  console.log("DEBUG murid after close @", muridAfterClose.path);
  console.log("DEBUG murid text:", muridAfterClose.text);
  const locked = muridAfterClose.text.includes("Sesi ini sudah ditutup oleh guru");
  check("Closed session locks the murid form", locked);
  check("Recorded status still visible after closing", muridAfterClose.text.includes("Sakit"));

  /* ---------------------------------------------------------------- *
   * 9. Guru recap aggregates per student
   * ---------------------------------------------------------------- */
  await guru.goto(`${BASE}/guru/rekap`, { waitUntil: "load" });
  await guru.waitForSelector("tbody tr");
  const recapRow = await guru.evaluate(() => {
    const row = [...document.querySelectorAll("tbody tr")].find((tr) =>
      tr.textContent.includes("Aditya Nugroho"),
    );
    return row
      ? [...row.querySelectorAll("td")].map((td) => td.textContent.trim())
      : null;
  });
  check(
    "Rekap counts murid01: 0 hadir, 1 sakit, 1/1 absen",
    Boolean(recapRow) &&
      recapRow[3] === "1/1" &&
      recapRow[4] === "0" &&
      recapRow[6] === "1" &&
      recapRow[7] === "0",
    JSON.stringify(recapRow),
  );

  /* class filters on the recap and the dashboard */
  await guru.goto(`${BASE}/guru/rekap?kelas=${encodeURIComponent("XI IPA 2")}`, {
    waitUntil: "load",
  });
  await guru.waitForSelector("tbody tr");
  const recapFiltered = await guru.evaluate(() => {
    const rows = [...document.querySelectorAll("tbody tr")].map((tr) => tr.textContent);
    return {
      count: rows.length,
      hasAditya: rows.some((t) => t.includes("Aditya Nugroho")),
      hasEka: rows.some((t) => t.includes("Eka Wulandari")),
    };
  });
  check(
    "Rekap class filter shows only that class",
    recapFiltered.count === 4 && recapFiltered.hasAditya && !recapFiltered.hasEka,
    JSON.stringify(recapFiltered),
  );

  await guru.goto(`${BASE}/guru?kelas=${encodeURIComponent("XI IPS 1")}`, {
    waitUntil: "load",
  });
  await sleep(800);
  const dashHidden = await guru.evaluate((t) => !document.body.innerText.includes(t), title);
  check("Dashboard class filter hides other classes' sessions", dashHidden);

  await guru.goto(`${BASE}/guru?kelas=${encodeURIComponent("XI IPA 2")}`, {
    waitUntil: "load",
  });
  await sleep(800);
  const dashShown = await guru.evaluate((t) => document.body.innerText.includes(t), title);
  check("Dashboard class filter shows the matching session", dashShown);

  /* ---------------------------------------------------------------- *
   * 10. CSV exports are authorised and return data
   * ---------------------------------------------------------------- */
  const csvGuru = await guru.evaluate(async () => {
    const res = await fetch("/guru/rekap/csv");
    const bytes = new Uint8Array(await res.arrayBuffer());
    return {
      status: res.status,
      disposition: res.headers.get("content-disposition"),
      hasBom: bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf,
      length: bytes.length,
    };
  });
  check(
    "Rekap CSV downloads with UTF-8 BOM",
    csvGuru.status === 200 &&
      /attachment/.test(csvGuru.disposition || "") &&
      csvGuru.hasBom,
    `${csvGuru.status} bom=${csvGuru.hasBom} bytes=${csvGuru.length}`,
  );

  const sessionId2 = sessionUrl.split("/").pop();
  const csvFiltered = await guru.evaluate(async (slug) => {
    const res = await fetch(`/guru/rekap/csv?kelas=${encodeURIComponent(slug)}`);
    const body = await res.text();
    return {
      status: res.status,
      disposition: res.headers.get("content-disposition"),
      body,
    };
  }, "XI IPA 2");
  check(
    "Rekap CSV honours the class filter",
    csvFiltered.status === 200 &&
      /Aditya Nugroho/.test(csvFiltered.body) &&
      !/Eka Wulandari/.test(csvFiltered.body) &&
      /Kelas[\s\S]*XI IPA 2/.test(csvFiltered.body),
    `${csvFiltered.status} ${(csvFiltered.disposition || "")}`,
  );

  const csvSession = await guru.evaluate(async (id) => {
    const res = await fetch(`/guru/sesi/${id}/csv`);
    const body = await res.text();
    return { status: res.status, disposition: res.headers.get("content-disposition"), body };
  }, sessionId2);
  check(
    "Session CSV lists the murid and his status",
    csvSession.status === 200 && /murid01/.test(csvSession.body) && /Sakit/.test(csvSession.body),
    `${csvSession.status} ${(csvSession.disposition || "")}`,
  );

  /* ---------------------------------------------------------------- *
   * 11. Guru manages students and classes
   * ---------------------------------------------------------------- */
  await guru.goto(`${BASE}/guru/murid`, { waitUntil: "load" });
  await guru.waitForSelector('input[name="name"]');
  const unlabeledAdmin = await unlabeledControls(guru);
  check("Student-admin controls are labelled", unlabeledAdmin.length === 0, JSON.stringify(unlabeledAdmin));

  /* a broken id must reach the styled 404, not an error shell */
  const nfRes = await guru.goto(`${BASE}/guru/sesi/999999`, { waitUntil: "load" });
  const nfText = await guru.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
  check("Unknown session id answers 404", nfRes?.status() === 404, String(nfRes?.status()));
  check("Custom 404 page is rendered", nfText.includes("Tidak ditemukan"), nfText.slice(0, 90));
  check("404 page keeps the monochrome chrome", nfText.includes("404") && nfText.includes("Ke beranda"), "");

  /* and the 404 text must not simply be present everywhere (it ships in the
     flight payload, so only a rendered page may count) */
  const okRes = await guru.goto(`${BASE}${sessionUrl}`, { waitUntil: "load" });
  const okHasCode = (await guru.$('[data-testid="session-code"]')) !== null;
  check(
    "Valid session still answers 200 with its own content",
    okRes?.status() === 200 && okHasCode,
    `status=${okRes?.status()} code=${okHasCode}`,
  );

  await guru.goto(`${BASE}/guru/murid`, { waitUntil: "load" });
  await guru.waitForSelector('input[name="name"]');
  await guru.type('input[name="name"]', "Rina Amelia");
  await guru.type('input[name="username"]', "murid99");
  await guru.type('input[name="kelasBaru"]', "XI MIPA 1");
  await guru.click('main form button[type="submit"]');

  const added = await waitFor(
    async () => {
      const t = await guru.evaluate(() => document.body.innerText);
      return t.includes("Rina Amelia") && t.includes("murid99") ? t : null;
    },
    { label: "student added" },
  ).catch(() => null);
  check("Guru adds a student into a brand-new class", Boolean(added),
    added ? "Rina Amelia visible" : "not visible");

  await guru.goto(`${BASE}/guru`, { waitUntil: "load" });
  await sleep(700);
  const chipShown = await guru.evaluate(() => document.body.innerText.includes("XI MIPA 1"));
  check("New class shows up as a filter chip on the dashboard", chipShown);

  /* rename that class and confirm both roster and chips follow */
  await guru.goto(`${BASE}/guru/murid`, { waitUntil: "load" });
  await guru.waitForSelector('select[name="renameFrom"]');
  await guru.select('select[name="renameFrom"]', "XI MIPA 1");
  await guru.type('input[name="renameTo"]', "XI MIPA 9");
  const clickedRename = await guru.evaluate(() => {
    const form = document.querySelector('select[name="renameFrom"]')?.closest("form");
    const btn = form?.querySelector('button[type="submit"]');
    if (!btn) return false;
    btn.click();
    return true;
  });
  check("Rename form is wired to its own submit button", clickedRename);

  const renamedRow = await waitFor(
    async () => {
      const text = await guru.evaluate(() => {
        const row = [...document.querySelectorAll("tbody tr")].find((tr) =>
          tr.textContent.includes("Rina Amelia"),
        );
        return row ? row.textContent.replace(/\s+/g, " ") : null;
      });
      return text && text.includes("XI MIPA 9") ? text : null;
    },
    { label: "class renamed in roster" },
  ).catch(() => null);
  check("Renamed class applies to the student row", Boolean(renamedRow),
    (renamedRow || "").slice(0, 80));
  check("Old class name is gone from the roster", Boolean(renamedRow) && !renamedRow.includes("XI MIPA 1"));

  const renameMsg = await guru.evaluate(() => document.body.innerText);
  check("Rename reports how many records moved", /menjadi/.test(renameMsg) && /sesi ikut berpindah/.test(renameMsg),
    renameMsg.match(/"XI MIPA 1"[^"]*"XI MIPA 9"[^\n]*/)?.[0] || "no message");

  await guru.goto(`${BASE}/guru`, { waitUntil: "load" });
  await sleep(700);
  const chipRenamed = await guru.evaluate(() => {
    const t = document.body.innerText;
    return t.includes("XI MIPA 9") && !t.includes("XI MIPA 1");
  });
  check("Filter chip follows the renamed class", chipRenamed);

  /* move Rina back to XI IPA 2 through the row form */
  await guru.goto(`${BASE}/guru/murid`, { waitUntil: "load" });
  await guru.waitForSelector("tbody tr");
  const moved = await guru.evaluate(() => {
    const row = [...document.querySelectorAll("tbody tr")].find((tr) =>
      tr.textContent.includes("Rina Amelia"),
    );
    if (!row) return "row missing";
    const select = row.querySelector('select[name="kelas"]');
    if (!select) return "select missing";
    select.value = "XI IPA 2";
    const submit = [...row.querySelectorAll('button[type="submit"]')].find((b) =>
      b.textContent.includes("Simpan"),
    );
    if (!submit) return "submit missing";
    submit.click();
    return true;
  });
  check("Row form for changing class is present", moved === true, String(moved));

  const afterMove = await waitFor(
    async () => {
      const t = await guru.evaluate(() => document.body.innerText);
      return t.includes("Rina Amelia") && /Rina Amelia[\s\S]{0,160}XI IPA 2/.test(t)
        ? t
        : null;
    },
    { label: "class change applied" },
  ).catch(() => null);
  check("Student can be moved to another class", Boolean(afterMove));

  /* delete her again */
  const clickedDelete = await guru.evaluate(() => {
    const row = [...document.querySelectorAll("tbody tr")].find((tr) =>
      tr.textContent.includes("Rina Amelia"),
    );
    const btn = row && [...row.querySelectorAll("button")].find((b) => b.textContent.trim() === "Hapus");
    if (!btn) return false;
    btn.click();
    return true;
  });
  check("Delete asks for confirmation first", clickedDelete);
  await sleep(400);
  const confirmed = await guru.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find((b) =>
      b.textContent.includes("Ya, hapus"),
    );
    if (!btn) return false;
    btn.click();
    return true;
  });
  check("Confirmation button appears", confirmed);

  const removed = await waitFor(
    async () => {
      const t = await guru.evaluate(() => document.body.innerText);
      return !t.includes("Rina Amelia") ? t : null;
    },
    { label: "student removed" },
  ).catch(() => null);
  check("Guru can delete a student", Boolean(removed));

  /* duplicate username must be rejected */
  await guru.goto(`${BASE}/guru/murid`, { waitUntil: "load" });
  await guru.waitForSelector('input[name="name"]');
  await guru.type('input[name="name"]', "Impostor");
  await guru.type('input[name="username"]', "murid01");
  await guru.type('input[name="kelasBaru"]', "XI IPA 2");
  await guru.click('main form button[type="submit"]');
  const dupRejected = await waitFor(
    async () => {
      const t = await guru.evaluate(() => document.body.innerText);
      return t.includes("sudah dipakai") ? t : null;
    },
    { label: "duplicate username rejected" },
  ).catch(() => null);
  check("Duplicate username is rejected", Boolean(dupRejected),
    (dupRejected || "").match(/Username[^\n]*sudah dipakai\.?/)?.[0] || "no message");

  /* ---------------------------------------------------------------- *
   * 12. Dark mode really applies (not just present in the CSS)
   * ---------------------------------------------------------------- */
  const parseRgb = (str) => {
    const m = String(str).match(/[\d.]+/g);
    return m ? m.slice(0, 3).map(Number) : null;
  };
  const luminance = ([r, g, b]) => {
    const f = (c) => {
      const v = c / 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const contrast = (a, b) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };

  async function palette(scheme) {
    const ctx = await browser.createBrowserContext();
    const p = await ctx.newPage();
    await p.emulateMediaFeatures([{ name: "prefers-color-scheme", value: scheme }]);
    await p.goto(`${BASE}/login`, { waitUntil: "load" });
    const colors = await p.evaluate(() => {
      const body = getComputedStyle(document.body);
      const input = document.querySelector('input[name="username"]');
      const button = document.querySelector('main form button[type="submit"]');
      return {
        bg: body.backgroundColor,
        fg: body.color,
        inputBorder: input ? getComputedStyle(input).borderColor : null,
        btnBg: button ? getComputedStyle(button).backgroundColor : null,
        btnFg: button ? getComputedStyle(button).color : null,
      };
    });
    await ctx.close();
    return colors;
  }

  const light = await palette("light");
  const dark = await palette("dark");
  check(
    "Dark palette actually differs from light",
    light.bg !== dark.bg && light.fg !== dark.fg,
    `${light.bg}/${light.fg} vs ${dark.bg}/${dark.fg}`,
  );
  const lightRatio = contrast(parseRgb(light.fg), parseRgb(light.bg));
  const darkRatio = contrast(parseRgb(dark.fg), parseRgb(dark.bg));
  check(
    "Body text keeps >= 4.5:1 contrast in both schemes",
    lightRatio >= 4.5 && darkRatio >= 4.5,
    `light ${lightRatio.toFixed(2)} dark ${darkRatio.toFixed(2)}`,
  );
  const darkBtn = contrast(parseRgb(dark.btnFg), parseRgb(dark.btnBg));
  check("Primary button stays readable in dark mode", darkBtn >= 4.5, darkBtn.toFixed(2));
  const darkBorder = contrast(parseRgb(dark.inputBorder), parseRgb(dark.bg));
  check("Input border is visible against the dark canvas", darkBorder > 1.1, darkBorder.toFixed(2));

  /* same measurement on every logged-in page, for both actors */
  const measureScheme = async (page) => {
    const c = await page.evaluate(() => {
      const body = getComputedStyle(document.body);
      return {
        bg: body.backgroundColor,
        fg: body.color,
        errorShell: document.documentElement.id === "__next_error__",
      };
    });
    return { ratio: contrast(parseRgb(c.fg), parseRgb(c.bg)), errorShell: c.errorShell };
  };

  await guru.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "dark" }]);
  const guruDark = [];
  for (const path of ["/guru", "/guru/rekap", "/guru/murid", sessionUrl]) {
    await guru.goto(`${BASE}${path}`, { waitUntil: "load" });
    await sleep(500);
    guruDark.push({ path, ...(await measureScheme(guru)) });
  }
  check(
    "All guru pages render in dark mode without an error shell",
    guruDark.every((r) => !r.errorShell),
    guruDark.map((r) => r.path).join(" "),
  );
  check(
    "All guru pages keep >= 4.5:1 text contrast in dark mode",
    guruDark.every((r) => r.ratio >= 4.5),
    guruDark.map((r) => `${r.path}:${r.ratio.toFixed(2)}`).join(" "),
  );

  await murid.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "dark" }]);
  const muridDark = [];
  for (const path of ["/murid", muridSessionUrl]) {
    await murid.goto(`${BASE}${path}`, { waitUntil: "load" });
    await sleep(500);
    muridDark.push({ path, ...(await measureScheme(murid)) });
  }
  check(
    "All murid pages render in dark mode without an error shell",
    muridDark.every((r) => !r.errorShell),
    muridDark.map((r) => r.path).join(" "),
  );
  check(
    "All murid pages keep >= 4.5:1 text contrast in dark mode",
    muridDark.every((r) => r.ratio >= 4.5),
    muridDark.map((r) => `${r.path}:${r.ratio.toFixed(2)}`).join(" "),
  );

  /* ---------------------------------------------------------------- *
   * 13. A murid cannot reach teacher-only routes
   * ---------------------------------------------------------------- */
  await murid.goto(`${BASE}/guru`, { waitUntil: "load" });
  await waitFor(() => murid.evaluate(() => location.pathname !== "/guru"), {
    label: "role guard",
  }).then(
    () => check("Murid is bounced off /guru", true),
    (e) => check("Murid is bounced off /guru", false, e.message),
  );

  await murid.goto(`${BASE}/guru/murid`, { waitUntil: "load" });
  await waitFor(() => murid.evaluate(() => location.pathname !== "/guru/murid"), {
    label: "student-admin guard",
  }).then(
    () => check("Murid is bounced off the student-admin page", true),
    (e) => check("Murid is bounced off the student-admin page", false, e.message),
  );
  const adminLeak = await murid.evaluate(() =>
    document.body.innerText.includes("Tambah murid"),
  );
  check("Student-admin form is not leaked to a murid", !adminLeak);
} catch (err) {
  check("Test run completed", false, err.message);
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
