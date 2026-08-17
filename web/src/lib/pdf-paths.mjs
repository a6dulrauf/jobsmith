/**
 * pdf-paths.mjs — deterministic scratch + final paths for a web "pdf" run (#2172).
 *
 * Plain .mjs (same pattern as clean-chips.mjs / tracker-table.mjs) so this can
 * be unit-tested with `node --test`, no TypeScript build step. `careerOpsRoot`
 * and `findReportFile` are passed in rather than imported from career-ops.ts,
 * keeping this module free of TypeScript dependencies.
 */
import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";

/**
 * Lowercase, non-alphanumeric runs -> single hyphen, trimmed.
 * @param {string} s
 * @returns {string}
 */
export function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/**
 * @typedef {Object} PdfPaths
 * @property {string} html - Backend-dictated path the agent must write the tailored HTML to.
 * @property {string} meta - Backend-dictated path the agent must write the {"format": ...} sidecar to.
 * @property {string} finalPdf - Where the backend renders the final PDF (output/cv-{candidate}-{company}-{date}.pdf).
 */

/**
 * Precompute the scratch (HTML + format sidecar) and final PDF paths for a
 * "pdf" run, so the agent never chooses its own filenames — the backend owns
 * naming, and later, rendering. Resolves the report (for the company slug)
 * and config/profile.yml (for the candidate slug) — same naming convention
 * modes/pdf.md documents, so web and CLI output stay byte-identical.
 *
 * Framework-agnostic: returns a result instead of constructing a Response, so
 * the caller (a Next.js route today) decides how to surface `ok: false`.
 *
 * Side effect: creates `.career-ops-web/pdf-tmp/` under `root` if it doesn't
 * exist yet (the agent needs it to exist before it can write there) — this is
 * NOT a pure path computation, despite the name.
 *
 * @param {string} input - The report number (e.g. "018").
 * @param {string} today - YYYY-MM-DD.
 * @param {string} root - careerOpsRoot().
 * @param {(input: string) => string | null} findReportFile - career-ops.ts's findReportFile.
 * @returns {{ok: true, paths: PdfPaths} | {ok: false, error: string}}
 */
export function resolvePdfPaths(input, today, root, findReportFile) {
  // Reject anything but a bare report number before it ever reaches a path.
  // findReportFile()'s parseInt-based matching can still resolve a crafted
  // selector like "123/../../etc/passwd" to a legitimate report file, but the
  // raw string is also used verbatim below to build cv-web-${input}.html —
  // path.join would then honor those ".." segments and escape scratchDir.
  if (!/^\d+$/.test(input)) {
    return { ok: false, error: `Invalid report selector: "${input}"` };
  }
  const reportFile = findReportFile(input);
  if (!reportFile) {
    return { ok: false, error: `No report #${input} found — evaluate this posting first.` };
  }
  const { companySlug, candidateSlug, scratchDir } = resolveSlugs(reportFile, root, "resolvePdfPaths");
  return {
    ok: true,
    paths: {
      html: path.join(scratchDir, `cv-web-${input}.html`),
      meta: path.join(scratchDir, `cv-web-${input}.meta.json`),
      finalPdf: path.join(root, "output", `cv-${candidateSlug}-${companySlug}-${today}.pdf`),
    },
  };
}

/**
 * Shared by every document kind: derive the company slug from the report
 * filename, the candidate slug from profile.yml, and ensure the scratch dir
 * exists. Extracted when cover letters and application emails joined CVs —
 * three copies of this would drift, and the filename convention is exactly
 * what keeps web and CLI output interchangeable.
 *
 * @param {string} reportFile - Absolute path to the resolved report.
 * @param {string} root - careerOpsRoot().
 * @param {string} caller - Name used in the warning message.
 */
function resolveSlugs(reportFile, root, caller) {
  const companyMatch = path.basename(reportFile).match(/^\d+-(.+)-\d{4}-\d{2}-\d{2}\.md$/);
  const companySlug = companyMatch ? companyMatch[1] : "company";
  let candidateSlug = "candidate";
  try {
    // js-yaml v4's load() uses the safe default schema (no arbitrary type
    // construction, unlike Python's PyYAML) — same pattern already used in
    // web/src/app/api/profile/route.ts and portals/route.ts.
    const profile = yaml.load(fs.readFileSync(path.join(root, "config", "profile.yml"), "utf8"));
    if (profile?.candidate?.full_name) candidateSlug = slugify(profile.candidate.full_name);
  } catch (err) {
    // A missing profile.yml is expected (not every checkout has one yet) and
    // falls back silently. Anything else — a real YAML syntax error in the
    // user's own file — should not fail silently forever; it would otherwise
    // produce a wrong-but-plausible-looking filename with zero signal.
    if (err?.code !== "ENOENT") {
      console.warn(`${caller}: could not read/parse config/profile.yml, defaulting candidate slug: ${err.message}`);
    }
  }
  const scratchDir = path.join(root, ".career-ops-web", "pdf-tmp");
  fs.mkdirSync(scratchDir, { recursive: true });
  return { companySlug, candidateSlug, scratchDir };
}

/**
 * Guard shared by every resolver: only a bare report number may reach path
 * construction. findReportFile()'s parseInt matching would happily resolve
 * "1/../../etc/passwd" to a real report, but the raw string is also
 * interpolated into filenames below, where path.join would honor those
 * segments and escape the scratch directory.
 */
function resolveReport(input, root, findReportFile) {
  if (!/^\d+$/.test(input)) return { ok: false, error: `Invalid report selector: "${input}"` };
  const reportFile = findReportFile(input);
  if (!reportFile) return { ok: false, error: `No report #${input} found — evaluate this posting first.` };
  return { ok: true, reportFile };
}

/**
 * Scratch payload + final PDF paths for a "cover" run.
 *
 * Mirrors the pdf split deliberately: the agent writes only the JSON payload
 * that modes/cover.md specifies, and the backend renders it with
 * generate-cover-letter.mjs. Rendering launches a real browser, which an agent
 * CLI's sandbox may block with no human present to approve the escalation.
 *
 * @returns {{ok: true, paths: {payload: string, finalPdf: string}} | {ok: false, error: string}}
 */
export function resolveCoverPaths(input, today, root, findReportFile) {
  const resolved = resolveReport(input, root, findReportFile);
  if (!resolved.ok) return resolved;
  const { companySlug, candidateSlug, scratchDir } = resolveSlugs(resolved.reportFile, root, "resolveCoverPaths");
  return {
    ok: true,
    paths: {
      payload: path.join(scratchDir, `cover-web-${input}.json`),
      finalPdf: path.join(root, "output", `cover-letter-${candidateSlug}-${companySlug}-${today}.pdf`),
    },
  };
}

/** Draft kinds that write a finished markdown file straight to output/. The
 *  prefix becomes the filename prefix, so it is allowlisted rather than
 *  interpolated from anything a request controls. */
const DRAFT_PREFIXES = new Set(["email", "contacto"]);

/**
 * Final draft path for a text-only run (application email, outreach message).
 *
 * No scratch/render split: these are text, so the agent writes the finished
 * markdown straight to output/, where the Documents page picks it up. They are
 * DRAFTS — career-ops never sends anything.
 *
 * @param {string} prefix - "email" | "contacto"
 * @returns {{ok: true, paths: {draft: string}} | {ok: false, error: string}}
 */
export function resolveDraftPaths(prefix, input, today, root, findReportFile) {
  if (!DRAFT_PREFIXES.has(prefix)) return { ok: false, error: `Unknown draft kind: "${prefix}"` };
  const resolved = resolveReport(input, root, findReportFile);
  if (!resolved.ok) return resolved;
  const { companySlug } = resolveSlugs(resolved.reportFile, root, "resolveDraftPaths");
  fs.mkdirSync(path.join(root, "output"), { recursive: true });
  return {
    ok: true,
    paths: { draft: path.join(root, "output", `${prefix}-${companySlug}-${today}.md`) },
  };
}

/** Back-compat wrapper — the email kind predates the generalization. */
export function resolveEmailPaths(input, today, root, findReportFile) {
  return resolveDraftPaths("email", input, today, root, findReportFile);
}

/**
 * Paths for a "compare" run across several evaluated offers.
 *
 * Input is a comma-separated list of report numbers, so there is no single
 * company to name the file after — the date plus the report numbers identifies
 * it. Every number is validated individually and must resolve to a real report;
 * a comparison against a missing report would be built on nothing.
 *
 * @returns {{ok: true, paths: {draft: string}, numbers: string[]} | {ok: false, error: string}}
 */
export function resolveComparePaths(input, today, root, findReportFile) {
  if (typeof input !== "string" || input.trim() === "") {
    return { ok: false, error: "Pick at least two evaluated offers to compare." };
  }
  const numbers = input.split(",").map((s) => s.trim()).filter(Boolean);
  if (numbers.length < 2) return { ok: false, error: "Comparing needs at least two offers." };
  if (numbers.length > 6) return { ok: false, error: "Compare at most six offers at once." };
  for (const n of numbers) {
    if (!/^\d+$/.test(n)) return { ok: false, error: `Invalid report selector: "${n}"` };
    if (!findReportFile(n)) return { ok: false, error: `No report #${n} found — evaluate it first.` };
  }
  fs.mkdirSync(path.join(root, "output"), { recursive: true });
  return {
    ok: true,
    numbers,
    paths: { draft: path.join(root, "output", `compare-${numbers.join("-")}-${today}.md`) },
  };
}

/**
 * Scratch payload path for an "add to CV" run.
 *
 * cv.md is the single source of truth every other mode reads, so this flow is
 * deliberately two-step: the agent writes a payload here, the backend runs
 * add-entry.mjs --dry-run to build a preview, and only an explicit confirmation
 * runs the real insertion. Nothing touches cv.md without the user seeing it.
 *
 * @returns {{ok: true, paths: {payload: string}} | {ok: false, error: string}}
 */
export function resolveAddPaths(token, root) {
  // The token identifies one add session. Generated server-side, but validated
  // anyway because it lands in a filename.
  if (typeof token !== "string" || !/^[a-z0-9]{6,32}$/.test(token)) {
    return { ok: false, error: "Invalid add session token." };
  }
  const scratchDir = path.join(root, ".career-ops-web", "pdf-tmp");
  fs.mkdirSync(scratchDir, { recursive: true });
  return { ok: true, paths: { payload: path.join(scratchDir, `add-${token}.json`) } };
}
