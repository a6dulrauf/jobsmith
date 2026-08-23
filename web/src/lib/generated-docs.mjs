// Which documents have actually been generated for one offer.
//
// Two bugs made this necessary, and they share a root cause: the portal decided
// what existed by guessing instead of looking.
//
//   1. /api/cv-pdf matched any PDF in output/ whose name contained the company
//      slug and served the newest. `cover-letter-abdul-rauf-hellofresh-….pdf`
//      contains the slug, so "View tailored CV" opened the cover letter. The
//      route knew the pdf mode writes `cv-…` — the comment says so — but never
//      filtered on it.
//
//   2. The cover-letter / email / outreach buttons read their state from the
//      browser's job history in localStorage. Files sitting in output/ were
//      invisible if the job entry was cleared, or belonged to another browser,
//      or errored after the file had already been written — which is exactly
//      what happens after an interrupted run. The portal offered to generate
//      documents the user already had.
//
// Both are fixed by reading the directory and keying on the FILENAME PREFIX the
// generators actually use, which is the only thing that distinguishes a CV from
// a cover letter for the same company on the same day.

import fs from "node:fs";
import path from "node:path";

/** Prefix → kind. Order matters: `cover-letter-` must be tested before any
 *  shorter prefix that could also match it. Kept as an array, not an object,
 *  so that ordering is explicit rather than an accident of key insertion. */
const KINDS = [
  ["cv-", "cv"],
  ["cover-letter-", "cover"],
  ["email-", "email"],
  ["contacto-", "contacto"],
];

/** Extensions a generated document can have. `.md` matters: the email and
 *  outreach modes write markdown drafts, not PDFs. */
const EXTS = new Set([".pdf", ".md", ".html"]);

/**
 * Slugify a company name the way the generators do: lowercase alphanumeric
 * tokens joined by hyphens. Token-extract rather than replace-then-trim, so
 * there is no `-+$`-style pattern that backtracks polynomially on hostile
 * input (CodeQL flagged that shape in the route this replaces).
 * @param {string} company
 */
export function companySlug(company) {
  return ((company ?? "").toLowerCase().match(/[a-z0-9]+/g) ?? []).join("-");
}

/**
 * Find the newest generated document of each kind for one company.
 *
 * @param {string} root  career-ops root
 * @param {string} company  e.g. "HelloFresh"
 * @returns {{cv: string|null, cover: string|null, email: string|null, contacto: string|null}}
 *   Each value is a path relative to root (e.g. "output/cv-…pdf") or null.
 */
export function findGeneratedDocs(root, company) {
  const found = { cv: null, cover: null, email: null, contacto: null };
  const slug = companySlug(company);
  if (!slug) return found;

  const dir = path.join(root, "output");
  let entries;
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return found; // nothing generated yet
  }

  // Match the slug only at a token boundary, so "Meta" never picks up
  // "Metabase"'s documents.
  const escaped = slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`);

  /** @type {Record<string, number>} newest mtime seen per kind */
  const newest = {};

  for (const name of entries) {
    const lower = name.toLowerCase();
    if (!EXTS.has(path.extname(lower))) continue;
    if (!re.test(lower)) continue;

    const hit = KINDS.find(([prefix]) => lower.startsWith(prefix));
    if (!hit) continue;
    const kind = hit[1];

    let mtime;
    try {
      mtime = fs.statSync(path.join(dir, name)).mtimeMs;
    } catch {
      continue; // vanished between readdir and stat
    }
    if (newest[kind] === undefined || mtime > newest[kind]) {
      newest[kind] = mtime;
      found[kind] = `output/${name}`;
    }
  }

  return found;
}
