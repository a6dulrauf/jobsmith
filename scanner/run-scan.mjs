#!/usr/bin/env node
/**
 * run-scan.mjs — the daily job: scan, work out what is genuinely new, email it.
 *
 * Runs scan.mjs (zero LLM tokens, public ATS APIs only), then determines the new
 * postings by diffing data/scan-history.tsv from before the run. That file is the
 * scanner's own dedup ledger, which makes it the authoritative answer to "have I
 * seen this before" — more reliable than parsing the scanner's console output.
 *
 * Because the ledger is the source of truth, the workflow MUST commit it back
 * after each run. If it does not, every run re-reports the same jobs forever.
 *
 * Runs from the repo root: one portals.yml, one scan-history ledger, shared with
 * the local app. The earlier standalone-repo layout duplicated both, which meant
 * the CI scan and the portal could silently drift onto different filters.
 *
 * Usage:
 *   node scanner/run-scan.mjs                 # scan, then email/print what is new
 *   node run-scan.mjs --dry-run       # scan without writing or sending
 *   node run-scan.mjs --no-email      # scan and print, never send
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const APP_ROOT = path.resolve(import.meta.dirname, "..");
const ROOT = APP_ROOT;
const HISTORY = path.join(ROOT, "data", "scan-history.tsv");
const ROWS_OUT = path.join(ROOT, "data", "new-postings.json");

const dryRun = process.argv.includes("--dry-run");
const noEmail = process.argv.includes("--no-email") || dryRun;

/** Every URL already in the ledger. Absent ledger = first run, everything is new. */
function readSeen() {
  try {
    return new Set(
      fs
        .readFileSync(HISTORY, "utf8")
        .split("\n")
        .slice(1)
        .map((l) => l.split("\t")[0])
        .filter(Boolean),
    );
  } catch {
    return new Set();
  }
}

/** Ledger rows whose URL is not in `before`, parsed into what the email needs. */
function newRowsSince(before) {
  let lines;
  try {
    lines = fs.readFileSync(HISTORY, "utf8").split("\n");
  } catch {
    return [];
  }
  const header = (lines[0] ?? "").split("\t");
  const col = (name) => header.indexOf(name);
  const iUrl = col("url");
  const iTitle = col("title");
  const iCompany = col("company");
  const iLocation = col("location");
  const iStatus = col("status");
  if (iUrl === -1) return [];

  const out = [];
  for (const line of lines.slice(1)) {
    if (!line.trim()) continue;
    const f = line.split("\t");
    const url = f[iUrl];
    if (!url || before.has(url)) continue;
    // "added" means it reached the pipeline. Rows recorded as blocked/invalid are
    // ledger entries, not opportunities, and must not be emailed as finds.
    if (iStatus !== -1 && f[iStatus] && f[iStatus] !== "added") continue;
    out.push({
      url,
      title: (iTitle !== -1 ? f[iTitle] : "") || "(untitled)",
      company: (iCompany !== -1 ? f[iCompany] : "") || "Unknown",
      location: iLocation !== -1 ? f[iLocation] || "" : "",
    });
  }
  return out;
}

const before = readSeen();
console.log(`Ledger holds ${before.size} previously-seen postings.`);

const scanArgs = ["scan.mjs"];
if (dryRun) scanArgs.push("--dry-run");
const scan = spawnSync(process.execPath, scanArgs, { cwd: APP_ROOT, encoding: "utf8" });
process.stdout.write(scan.stdout ?? "");
if (scan.stderr?.trim()) process.stderr.write(scan.stderr);

// A scan that dies must fail the job loudly. Silence here would look identical
// to "no new jobs today", which is the failure mode that quietly wastes months.
if (scan.status !== 0) {
  console.error(`\nscan.mjs exited ${scan.status} — treating this run as failed rather than reporting zero finds.`);
  process.exit(1);
}

if (dryRun) {
  console.log("\n--dry-run: nothing written, nothing sent.");
  process.exit(0);
}

const rows = newRowsSince(before);
console.log(`\n${rows.length} genuinely new posting(s) since the last run.`);

if (rows.length === 0) {
  // Deliberately silent: a daily "nothing new" email trains you to ignore the
  // sender, which costs you the day there IS something.
  console.log("Nothing new — no email sent.");
  process.exit(0);
}

fs.writeFileSync(ROWS_OUT, JSON.stringify(rows, null, 2));

if (noEmail) {
  console.log(`--no-email: wrote ${path.relative(ROOT, ROWS_OUT)} instead of sending.`);
  process.exit(0);
}

const digest = spawnSync(process.execPath, [path.join(import.meta.dirname, "digest.mjs"), "--json", ROWS_OUT], { cwd: APP_ROOT, encoding: "utf8" });
process.stdout.write(digest.stdout ?? "");
if (digest.stderr?.trim()) process.stderr.write(digest.stderr);
process.exit(digest.status ?? 0);
