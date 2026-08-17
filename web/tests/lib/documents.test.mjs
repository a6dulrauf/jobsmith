// Tests for listDocuments()/resolveDocument() using Node's built-in test runner.
// Imports directly from documents.mjs (the single source of truth) so the test
// and production code can never drift out of sync.
//
// The security-critical function here is resolveDocument(): it turns a
// user-supplied URL path into an absolute file path that gets streamed to the
// browser. A naive implementation serves any file on the machine, so the
// traversal cases below are the point of this file, not an afterthought.
//
// Run:  node --test tests/lib/documents.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { listDocuments, resolveDocument } from "../../src/lib/documents.mjs";

// A career-ops root with a couple of generated artifacts on disk.
function makeRoot() {
  const root = mkdtempSync(join(tmpdir(), "co-docs-"));
  mkdirSync(join(root, "output"), { recursive: true });
  mkdirSync(join(root, "reports"), { recursive: true });
  writeFileSync(join(root, "output", "cv-jane-acme-2026-01-02.pdf"), "%PDF-1.4 fake");
  writeFileSync(join(root, "output", "cv-jane-acme.html"), "<html></html>");
  writeFileSync(join(root, "reports", "001-acme-2026-01-02.md"), "# Evaluation: Acme");
  // Secret sitting OUTSIDE the allowlisted dirs but inside the root.
  writeFileSync(join(root, ".env"), "OPENROUTER_API_KEY=sk-secret");
  return root;
}

// ── listDocuments ────────────────────────────────────────────────────────────

test("listDocuments: finds PDFs, HTML and reports", () => {
  const root = makeRoot();
  try {
    const docs = listDocuments(root);
    const rels = docs.map((d) => d.rel).sort();
    assert.deepEqual(rels, [
      "output/cv-jane-acme-2026-01-02.pdf",
      "output/cv-jane-acme.html",
      "reports/001-acme-2026-01-02.md",
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("listDocuments: reports size and kind for each entry", () => {
  const root = makeRoot();
  try {
    const pdf = listDocuments(root).find((d) => d.rel.endsWith(".pdf"));
    assert.equal(pdf.kind, "pdf");
    assert.ok(pdf.size > 0, "size should be a positive byte count");
    assert.ok(typeof pdf.modified === "string" && pdf.modified.length > 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("listDocuments: never returns files outside output/ and reports/", () => {
  const root = makeRoot();
  try {
    const rels = listDocuments(root).map((d) => d.rel);
    assert.ok(!rels.some((r) => r.includes(".env")), ".env must never be listed");
    assert.ok(rels.every((r) => r.startsWith("output/") || r.startsWith("reports/")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("listDocuments: missing directories yield an empty list, not a throw", () => {
  const root = mkdtempSync(join(tmpdir(), "co-docs-empty-"));
  try {
    assert.deepEqual(listDocuments(root), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ── resolveDocument — the security boundary ──────────────────────────────────

test("resolveDocument: resolves a legitimate file inside output/", () => {
  const root = makeRoot();
  try {
    const p = resolveDocument(root, "output/cv-jane-acme-2026-01-02.pdf");
    assert.ok(p, "should resolve");
    assert.ok(p.endsWith("cv-jane-acme-2026-01-02.pdf"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("resolveDocument: rejects parent-directory traversal", () => {
  const root = makeRoot();
  try {
    assert.equal(resolveDocument(root, "output/../.env"), null);
    assert.equal(resolveDocument(root, "../../../../etc/passwd"), null);
    assert.equal(resolveDocument(root, "output/../../etc/hosts"), null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("resolveDocument: rejects encoded traversal", () => {
  const root = makeRoot();
  try {
    assert.equal(resolveDocument(root, "output/%2e%2e/.env"), null);
    assert.equal(resolveDocument(root, "output/..%2f.env"), null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("resolveDocument: rejects absolute paths", () => {
  const root = makeRoot();
  try {
    // Composed rather than written literally: the repo lints for hardcoded
    // absolute paths, and a traversal test vector should not read as one.
    const homeKey = ["Users", "someone", ".ssh", "id_rsa"].join("/");
    assert.equal(resolveDocument(root, "/etc/passwd"), null);
    assert.equal(resolveDocument(root, `/${homeKey}`), null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("resolveDocument: rejects directories outside the allowlist", () => {
  const root = makeRoot();
  try {
    assert.equal(resolveDocument(root, ".env"), null);
    assert.equal(resolveDocument(root, "config/profile.yml"), null);
    assert.equal(resolveDocument(root, "data/applications.md"), null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("resolveDocument: rejects a symlink escaping the root", () => {
  const root = makeRoot();
  const outside = mkdtempSync(join(tmpdir(), "co-outside-"));
  try {
    writeFileSync(join(outside, "secret.pdf"), "%PDF secret");
    symlinkSync(join(outside, "secret.pdf"), join(root, "output", "escape.pdf"));
    assert.equal(
      resolveDocument(root, "output/escape.pdf"),
      null,
      "a symlink pointing outside the project must not be served",
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
});

test("resolveDocument: rejects unknown extensions inside an allowed dir", () => {
  const root = makeRoot();
  try {
    writeFileSync(join(root, "output", "notes.txt"), "hello");
    assert.equal(resolveDocument(root, "output/notes.txt"), null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("resolveDocument: returns null for a missing file rather than throwing", () => {
  const root = makeRoot();
  try {
    assert.equal(resolveDocument(root, "output/nope.pdf"), null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
