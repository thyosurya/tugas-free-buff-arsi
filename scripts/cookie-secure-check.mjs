/**
 * Verifies src/lib/auth.ts sets the session cookie's Secure flag based on
 * x-forwarded-proto, using a real (JavaScript-free) login form submission.
 *
 * Run against a live server: node scripts/cookie-secure-check.mjs
 */
const BASE = process.env.BASE_URL || "http://localhost:3000";
const COOKIE = "absensi_token";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  [${detail}]` : ""}`);
};

const decodeEntities = (s) =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

/** Reads the hidden $ACTION_* inputs React renders so forms work without JS. */
async function loginFields() {
  const res = await fetch(`${BASE}/login`);
  const html = await res.text();
  const fields = [];
  for (const tag of html.match(/<input[^>]*type="hidden"[^>]*>/g) ?? []) {
    const attrs = Object.fromEntries(
      [...tag.matchAll(/([a-zA-Z-]+)="([^"]*)"/g)].map((m) => [m[1], decodeEntities(m[2])]),
    );
    if (attrs.name) fields.push([attrs.name, attrs.value ?? ""]);
  }
  return fields;
}

async function attemptLogin(withForwardedProto) {
  const fields = await loginFields();

  // React renders encType="multipart/form-data" on server-action forms, so the
  // submission has to mirror that or the action is never decoded.
  const body = new FormData();
  for (const [name, value] of fields) body.append(name, value);
  body.append("username", "guru");
  body.append("password", "guru123");

  const headers = { Accept: "text/html" };
  if (withForwardedProto) headers["x-forwarded-proto"] = "https";

  const res = await fetch(`${BASE}/login`, {
    method: "POST",
    headers,
    body,
    redirect: "manual",
  });

  const setCookie = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
  const session = setCookie.filter((c) => c.startsWith(`${COOKIE}=`));
  await res.arrayBuffer().catch(() => null);
  return { status: res.status, session, actionFields: fields.length };
}

const plain = await attemptLogin(false);
check(
  "Login form submits without JavaScript",
  plain.actionFields > 0 && plain.session.length > 0,
  `fields=${plain.actionFields} status=${plain.status}`,
);
check(
  "Plain HTTP keeps the cookie non-Secure",
  plain.session.length > 0 && !/;\s*Secure/i.test(plain.session[0]),
  plain.session[0] || "no cookie",
);

const forwarded = await attemptLogin(true);
check(
  "x-forwarded-proto: https marks the cookie Secure",
  forwarded.session.length > 0 && /;\s*Secure/i.test(forwarded.session[0]),
  forwarded.session[0] || "no cookie",
);
check(
  "Session cookie stays HttpOnly behind HTTPS",
  forwarded.session.length > 0 && /HttpOnly/i.test(forwarded.session[0]),
  forwarded.session[0] || "no cookie",
);

const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
