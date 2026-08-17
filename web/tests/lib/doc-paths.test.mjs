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
