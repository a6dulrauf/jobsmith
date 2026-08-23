// documents.mjs — enumerate and safely resolve career-ops generated artifacts.
//
// The web UI surfaces the user's own generated files (tailored CV PDFs, cover
// letters, evaluation reports) so they don't have to dig through the filesystem.
// Those files are gitignored user data, which is exactly why they need a
// deliberate, narrow door rather than a generic static handler.
//
// resolveDocument() is a security boundary: it converts an untrusted URL segment
// into an absolute path whose bytes get streamed to the browser. It is therefore
// deny-by-default on four independent axes — directory allowlist, extension
// allowlist, no traversal segments, and a realpath containment check that
// defeats symlinks planted inside an allowed directory.
//
// Plain .mjs (not .ts) so `node --test` can import it directly, matching the
// precedent set by pdf-paths.mjs. See tests/lib/documents.test.mjs.

import fs from "node:fs";
import path from "node:path";

/** Only these directories are ever readable through the documents route. */
export const ALLOWED_DIRS = ["output", "reports"];

/** Reservation sentinels written by reserve-report-num.mjs to hold a report
 *  number while a worker runs. They are .md files in reports/, but they are
 *  bookkeeping, not documents — a 100-byte JSON stub listed as an "evaluation
 *  report" is noise at best and looks like a broken report at worst. A crashed
 *  worker leaves one behind until the 4h GC, so this is not a rare case. */
const RESERVED_SENTINEL_RE = /^\d+-RESERVED\.md$/;

/** Only these extensions are ever served. Keeps .env, .yml, .tsv and anything
 *  else that might land in an output directory out of reach even if the
 *  directory allowlist were somehow satisfied. */
const ALLOWED_EXT = new Map([
  [".pdf", "pdf"],
  [".html", "html"],
  [".md", "md"],
]);

/** True containment: resolves symlinks on BOTH sides before comparing, so a
 *  link planted under output/ cannot leak a file from elsewhere on the disk.
 *  Mirrors the containedRealpath() helper in career-ops.ts. */
function contained(abs, dir) {
  try {
    return fs.realpathSync(abs).startsWith(fs.realpathSync(dir) + path.sep);
  } catch {
    return false; // missing file, broken link, or unresolvable — treat as absent
  }
}

/**
 * Turn an untrusted relative path into an absolute path safe to stream.
 * Returns null for anything that fails a single check — never throws.
 *
 * @param {string} root - career-ops project root
 * @param {string} rel  - untrusted path, e.g. "output/cv-jane-acme.pdf"
 * @returns {string|null} absolute path, or null if not servable
 */
export function resolveDocument(root, rel) {
  if (typeof rel !== "string" || rel.trim() === "") return null;

  // Decode once so percent-encoded traversal ("%2e%2e", "..%2f") is rejected
  // explicitly rather than surviving as a literal filename that happens not to
  // exist. Malformed encoding is itself disqualifying.
  let decoded;
  try {
    decoded = decodeURIComponent(rel);
  } catch {
    return null;
  }

  // Normalize separators so Windows-style input can't sidestep the checks.
  decoded = decoded.replace(/\\/g, "/");

  if (path.isAbsolute(decoded)) return null;
  if (decoded.includes("\0")) return null;

  const segments = decoded.split("/").filter((s) => s !== "" && s !== ".");
  if (segments.length < 2) return null;
  if (segments.some((s) => s === "..")) return null;
  if (!ALLOWED_DIRS.includes(segments[0])) return null;

  const ext = path.extname(segments[segments.length - 1]).toLowerCase();
  if (!ALLOWED_EXT.has(ext)) return null;

  const baseDir = path.join(root, segments[0]);
  const abs = path.resolve(root, segments.join("/"));

  // Must live under its allowed directory even after symlinks are resolved.
  if (!contained(abs, baseDir)) return null;

  try {
    if (!fs.statSync(abs).isFile()) return null;
  } catch {
    return null;
  }

  return abs;
}

/**
 * List every servable artifact under the allowed directories.
 * Entries that would fail resolveDocument() are omitted, so the list can never
 * advertise a file the route would then refuse.
 *
 * @param {string} root - career-ops project root
 * @returns {Array<{rel: string, name: string, kind: string, size: number, modified: string}>}
 */
export function listDocuments(root) {
  const out = [];
  for (const dir of ALLOWED_DIRS) {
    const abs = path.join(root, dir);
    let entries;
    try {
      entries = fs.readdirSync(abs, { withFileTypes: true });
    } catch {
      continue; // directory absent — nothing generated yet
    }
    for (const e of entries) {
      if (!e.isFile() && !e.isSymbolicLink()) continue;
      if (RESERVED_SENTINEL_RE.test(e.name)) continue; // bookkeeping, not a document
      const ext = path.extname(e.name).toLowerCase();
      const kind = ALLOWED_EXT.get(ext);
      if (!kind) continue;
      const rel = `${dir}/${e.name}`;
      if (!resolveDocument(root, rel)) continue; // never list what we won't serve
      let stat;
      try {
        stat = fs.statSync(path.join(abs, e.name));
      } catch {
        continue;
      }
      out.push({
        rel,
        name: e.name,
        kind,
        size: stat.size,
        modified: stat.mtime.toISOString(),
      });
    }
  }
  // Newest first — the file you just generated should be at the top.
  out.sort((a, b) => (a.modified < b.modified ? 1 : a.modified > b.modified ? -1 : 0));
  return out;
}

/** Content-Type for a resolved document. */
export function contentTypeFor(abs) {
  switch (path.extname(abs).toLowerCase()) {
    case ".pdf":
      return "application/pdf";
    case ".html":
      return "text/html; charset=utf-8";
    default:
      return "text/plain; charset=utf-8";
  }
}
