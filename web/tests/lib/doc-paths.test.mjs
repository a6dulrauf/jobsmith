// Tests for resolveCoverPaths()/resolveEmailPaths() — the cover-letter and
// application-email siblings of resolvePdfPaths().
//
// The property that matters: the BACKEND owns filenames. The agent is told
// exactly where to write, so a crafted report selector must never escape the
// scratch directory or the output directory.
//
// Run:  node --test tests/lib/doc-paths.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join, isAbsolute } from "node:path";
import { tmpdir } from "node:os";
import { resolveCoverPaths, resolveEmailPaths } from "../../src/lib/pdf-paths.mjs";

function makeRoot({ profileYaml } = {}) {
  const root = mkdtempSync(join(tmpdir(), "co-docpaths-"));
  mkdirSync(join(root, "config"), { recursive: true });
  mkdirSync(join(root, "reports"), { recursive: true });
  writeFileSync(
    join(root, "config", "profile.yml"),
    profileYaml ?? 'candidate:\n  full_name: "Abdul Rauf"\n',
  );
  writeFileSync(join(root, "reports", "001-hellofresh-2026-08-13.md"), "# Evaluation");
  return root;
}

const finder = (root) => (n) =>
  n === "1" ? join(root, "reports", "001-hellofresh-2026-08-13.md") : null;

// ── cover letter ─────────────────────────────────────────────────────────────

test("resolveCoverPaths: derives payload + final PDF from report and profile", () => {
  const root = makeRoot();
  try {
    const r = resolveCoverPaths("1", "2026-08-17", root, finder(root));
    assert.equal(r.ok, true);
    assert.match(r.paths.payload, /cover-web-1\.json$/);
    assert.match(r.paths.finalPdf, /cover-letter-abdul-rauf-hellofresh-2026-08-17\.pdf$/);
    assert.ok(isAbsolute(r.paths.payload) && isAbsolute(r.paths.finalPdf));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("resolveCoverPaths: creates the scratch directory", () => {
  const root = makeRoot();
  try {
    resolveCoverPaths("1", "2026-08-17", root, finder(root));
    assert.ok(existsSync(join(root, ".career-ops-web", "pdf-tmp")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("resolveCoverPaths: rejects a non-numeric report selector", () => {
  const root = makeRoot();
  try {
    for (const bad of ["1/../../etc/passwd", "../1", "abc", "", "1;rm -rf /"]) {
      const r = resolveCoverPaths(bad, "2026-08-17", root, finder(root));
      assert.equal(r.ok, false, `"${bad}" must be rejected`);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("resolveCoverPaths: fails clearly when the report does not exist", () => {
  const root = makeRoot();
  try {
    const r = resolveCoverPaths("99", "2026-08-17", root, finder(root));
    assert.equal(r.ok, false);
    assert.match(r.error, /No report #99/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("resolveCoverPaths: missing profile.yml falls back to a candidate slug", () => {
  const root = mkdtempSync(join(tmpdir(), "co-docpaths-noprofile-"));
  mkdirSync(join(root, "reports"), { recursive: true });
  writeFileSync(join(root, "reports", "001-hellofresh-2026-08-13.md"), "# Evaluation");
  try {
    const r = resolveCoverPaths("1", "2026-08-17", root, finder(root));
    assert.equal(r.ok, true);
    assert.match(r.paths.finalPdf, /cover-letter-candidate-hellofresh-2026-08-17\.pdf$/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ── application email ────────────────────────────────────────────────────────

test("resolveEmailPaths: writes a markdown draft into output/", () => {
  const root = makeRoot();
  try {
    const r = resolveEmailPaths("1", "2026-08-17", root, finder(root));
    assert.equal(r.ok, true);
    assert.match(r.paths.draft, /output\/email-hellofresh-2026-08-17\.md$/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("resolveEmailPaths: rejects a non-numeric report selector", () => {
  const root = makeRoot();
  try {
    assert.equal(resolveEmailPaths("../x", "2026-08-17", root, finder(root)).ok, false);
    assert.equal(resolveEmailPaths("1/../..", "2026-08-17", root, finder(root)).ok, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("resolveEmailPaths: output path stays inside the project root", () => {
  const root = makeRoot();
  try {
    const r = resolveEmailPaths("1", "2026-08-17", root, finder(root));
    assert.ok(r.paths.draft.startsWith(root), "draft must live under the project root");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ── generalized draft paths, compare, and the add gate ───────────────────────

import { resolveDraftPaths, resolveComparePaths, resolveAddPaths } from "../../src/lib/pdf-paths.mjs";

test("resolveDraftPaths: writes contacto drafts into output/", () => {
  const root = makeRoot();
  try {
    const r = resolveDraftPaths("contacto", "1", "2026-08-17", root, finder(root));
    assert.equal(r.ok, true);
    assert.match(r.paths.draft, /output\/contacto-hellofresh-2026-08-17\.md$/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("resolveDraftPaths: refuses a prefix not on the allowlist", () => {
  const root = makeRoot();
  try {
    // The prefix lands in a filename, so it is allowlisted rather than trusted.
    for (const bad of ["../etc/passwd", "evaluate", "", "cv"]) {
      assert.equal(resolveDraftPaths(bad, "1", "2026-08-17", root, finder(root)).ok, false, bad);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("resolveComparePaths: accepts two or more real reports", () => {
  const root = makeRoot();
  const f = (n) => (n === "1" || n === "2" ? join(root, "reports", "001-hellofresh-2026-08-13.md") : null);
  try {
    const r = resolveComparePaths("1,2", "2026-08-17", root, f);
    assert.equal(r.ok, true);
    assert.deepEqual(r.numbers, ["1", "2"]);
    assert.match(r.paths.draft, /output\/compare-1-2-2026-08-17\.md$/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("resolveComparePaths: needs at least two, caps at six", () => {
  const root = makeRoot();
  const f = () => join(root, "reports", "001-hellofresh-2026-08-13.md");
  try {
    assert.equal(resolveComparePaths("1", "2026-08-17", root, f).ok, false);
    assert.equal(resolveComparePaths("", "2026-08-17", root, f).ok, false);
    assert.equal(resolveComparePaths("1,2,3,4,5,6,7", "2026-08-17", root, f).ok, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("resolveComparePaths: rejects a non-numeric or missing report in the list", () => {
  const root = makeRoot();
  const f = (n) => (n === "1" ? join(root, "reports", "001-hellofresh-2026-08-13.md") : null);
  try {
    assert.match(resolveComparePaths("1,../2", "2026-08-17", root, f).error, /Invalid report selector/);
    assert.match(resolveComparePaths("1,99", "2026-08-17", root, f).error, /No report #99/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("resolveAddPaths: validates the session token before it reaches a filename", () => {
  const root = makeRoot();
  try {
    assert.equal(resolveAddPaths("abc123", root).ok, true);
    for (const bad of ["../x", "a", "A".repeat(40), "tok en", "", "x/y"]) {
      assert.equal(resolveAddPaths(bad, root).ok, false, `"${bad}" must be rejected`);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
