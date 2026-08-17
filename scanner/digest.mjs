#!/usr/bin/env node
/**
 * digest.mjs — email a list of new job postings. Zero dependencies.
 *
 * SMTP is hand-rolled over node:tls rather than pulled from npm, for two
 * reasons: this runs in CI where every dependency is a supply-chain surface, and
 * an emailer is small enough that owning it is cheaper than trusting it.
 *
 * Usage:
 *   node digest.mjs --json rows.json --subject "..."     # send (or print)
 *   node digest.mjs --self-test                          # no network
 *
 * Env (all required to actually send; absent → prints to stdout instead):
 *   DIGEST_SMTP_HOST   default smtp.gmail.com
 *   DIGEST_SMTP_PORT   default 465 (implicit TLS)
 *   DIGEST_SMTP_USER
 *   DIGEST_SMTP_PASS   an app password, never your account password
 *   DIGEST_TO          defaults to DIGEST_SMTP_USER
 */

import tls from "node:tls";
import fs from "node:fs";

/** Escape for the HTML part. Job titles and company names come from third-party
 *  ATS feeds — untrusted text that must never be able to inject markup. */
export function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Strip CR/LF from anything entering a header, so a crafted value cannot inject
 *  extra headers (a classic SMTP header-injection). */
export function sanitizeHeader(s) {
  return String(s ?? "").replace(/[\r\n]+/g, " ").trim();
}

/** Group rows by company, newest first within each. */
export function buildBody(rows) {
  if (!rows.length) return { text: "No new postings.", html: "<p>No new postings.</p>" };

  const byCompany = new Map();
  for (const r of rows) {
    const key = r.company || "Unknown";
    if (!byCompany.has(key)) byCompany.set(key, []);
    byCompany.get(key).push(r);
  }
  const companies = [...byCompany.entries()].sort((a, b) => b[1].length - a[1].length);

  const textParts = [`${rows.length} new posting${rows.length === 1 ? "" : "s"}\n`];
  const htmlParts = [
    `<p style="font:14px/1.5 -apple-system,system-ui,sans-serif">`,
    `<strong>${rows.length} new posting${rows.length === 1 ? "" : "s"}</strong></p>`,
  ];

  for (const [company, list] of companies) {
    textParts.push(`\n${company} (${list.length})`);
    htmlParts.push(
      `<h3 style="font:600 14px -apple-system,system-ui,sans-serif;margin:18px 0 6px">${escapeHtml(company)} <span style="font-weight:400;color:#666">(${list.length})</span></h3><ul style="margin:0;padding-left:18px">`,
    );
    for (const r of list) {
      const loc = r.location ? ` — ${r.location}` : "";
      textParts.push(`  · ${r.title}${loc}\n    ${r.url}`);
      htmlParts.push(
        `<li style="font:13px/1.6 -apple-system,system-ui,sans-serif;margin-bottom:4px">` +
          `<a href="${escapeHtml(r.url)}" style="color:#0b6bcb;text-decoration:none">${escapeHtml(r.title)}</a>` +
          (r.location ? `<span style="color:#666"> — ${escapeHtml(r.location)}</span>` : "") +
          `</li>`,
      );
    }
    htmlParts.push(`</ul>`);
  }

  textParts.push(
    `\n—\nFound by your career-ops scanner. Nothing has been applied to; open the portal to evaluate any of these.`,
  );
  htmlParts.push(
    `<p style="font:12px/1.5 -apple-system,system-ui,sans-serif;color:#888;margin-top:22px">` +
      `Found by your career-ops scanner. Nothing has been applied to — open the portal to evaluate any of these.</p>`,
  );

  return { text: textParts.join("\n"), html: htmlParts.join("") };
}

/** Build a MIME multipart/alternative message. */
export function buildMessage({ from, to, subject, text, html }) {
  const boundary = `co_${Date.now().toString(36)}`;
  return [
    `From: ${sanitizeHeader(from)}`,
    `To: ${sanitizeHeader(to)}`,
    `Subject: ${sanitizeHeader(subject)}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/plain; charset=utf-8`,
    ``,
    text,
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset=utf-8`,
    ``,
    html,
    ``,
    `--${boundary}--`,
    ``,
  ].join("\r\n");
}

/** Minimal SMTP-over-implicit-TLS conversation. Resolves rather than throwing. */
export function sendMail({ host, port, user, pass, from, to, message, timeoutMs = 30_000 }) {
  return new Promise((resolve) => {
    const steps = [
      { expect: 220, send: `EHLO career-ops\r\n` },
      { expect: 250, send: `AUTH LOGIN\r\n` },
      { expect: 334, send: `${Buffer.from(user).toString("base64")}\r\n` },
      { expect: 334, send: `${Buffer.from(pass).toString("base64")}\r\n` },
      { expect: 235, send: `MAIL FROM:<${from}>\r\n` },
      { expect: 250, send: `RCPT TO:<${to}>\r\n` },
      { expect: 250, send: `DATA\r\n` },
      { expect: 354, send: `${message.replace(/\r\n\.\r\n/g, "\r\n..\r\n")}\r\n.\r\n` },
      { expect: 250, send: `QUIT\r\n` },
    ];
    let i = 0;
    let buf = "";
    let settled = false;
    const done = (r) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        socket.destroy();
      } catch {
        /* already gone */
      }
      resolve(r);
    };

    const socket = tls.connect({ host, port, servername: host });
    const timer = setTimeout(() => done({ ok: false, error: `SMTP timed out after ${timeoutMs}ms` }), timeoutMs);

    socket.on("error", (e) => done({ ok: false, error: `SMTP socket error: ${e.message}` }));
    socket.on("data", (chunk) => {
      buf += chunk.toString();
      // A reply is complete when a line starts with "NNN " (space, not hyphen).
      if (!/^\d{3} [^\n]*\r?\n$/m.test(buf.slice(buf.lastIndexOf("\n", buf.length - 2) + 1))) return;
      const code = parseInt(buf.trim().slice(-buf.trim().length).match(/(\d{3}) [^\n]*$/)?.[1] ?? "0", 10);
      const step = steps[i];
      if (!step) return done({ ok: true });
      if (code !== step.expect) {
        return done({ ok: false, error: `SMTP expected ${step.expect}, got ${code}: ${buf.trim().split("\n").pop()}` });
      }
      buf = "";
      i += 1;
      socket.write(step.send);
      if (i >= steps.length) done({ ok: true });
    });
  });
}

/* ── CLI ──────────────────────────────────────────────────────────────────── */

function arg(flag) {
  const i = process.argv.indexOf(flag);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

if (process.argv.includes("--self-test")) {
  const rows = [
    { company: "Acme", title: "Senior <b>Engineer</b>", location: "Berlin", url: "https://example.test/1" },
    { company: "Acme", title: "Staff Engineer", location: "Warsaw", url: "https://example.test/2" },
    { company: "Globex", title: "Platform Engineer", location: "London", url: "https://example.test/3" },
  ];
  const { text, html } = buildBody(rows);
  const assert = (c, m) => {
    if (!c) {
      console.error(`FAIL ${m}`);
      process.exit(1);
    }
    console.log(`PASS ${m}`);
  };
  assert(text.includes("3 new postings"), "counts postings");
  assert(html.includes("&lt;b&gt;"), "escapes HTML in titles (untrusted ATS text)");
  assert(!html.includes("<b>Engineer</b>"), "does not emit raw markup from a title");
  assert(text.indexOf("Acme") < text.indexOf("Globex"), "groups by company, biggest first");
  assert(buildBody([]).text === "No new postings.", "handles an empty list");
  assert(sanitizeHeader("a\r\nBcc: x@y") === "a Bcc: x@y", "strips CRLF from headers");
  const msg = buildMessage({ from: "a@b", to: "c@d", subject: "s\r\nX: y", text: "t", html: "<p>h</p>" });
  assert(!/Subject:.*\r\nX: y/.test(msg), "header injection via subject is neutralised");
  assert(msg.includes("multipart/alternative"), "builds a multipart message");
  console.log("digest self-test green");
  process.exit(0);
}

const jsonPath = arg("--json");
if (!jsonPath) {
  console.error("Usage: node digest.mjs --json rows.json [--subject '...']   |   --self-test");
  process.exit(2);
}

const rows = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
const { text, html } = buildBody(rows);
const subject = arg("--subject") ?? `career-ops: ${rows.length} new posting${rows.length === 1 ? "" : "s"}`;

const user = process.env.DIGEST_SMTP_USER;
const pass = process.env.DIGEST_SMTP_PASS;
const to = process.env.DIGEST_TO || user;

// No credentials configured is a legitimate mode, not an error: the run still
// reports what it found, it just prints instead of emailing. That keeps the
// workflow useful before SMTP is set up, and makes local testing trivial.
if (!user || !pass || !to) {
  console.log("(no SMTP credentials — printing instead of sending)\n");
  console.log(`Subject: ${subject}\n`);
  console.log(text);
  process.exit(0);
}

const result = await sendMail({
  host: process.env.DIGEST_SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.DIGEST_SMTP_PORT || 465),
  user,
  pass,
  from: user,
  to,
  message: buildMessage({ from: user, to, subject, text, html }),
});

if (!result.ok) {
  console.error(`Email failed: ${result.error}`);
  process.exit(1);
}
console.log(`Emailed ${rows.length} posting(s) to ${to}`);
