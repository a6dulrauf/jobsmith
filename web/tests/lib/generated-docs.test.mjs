// Tests for findGeneratedDocs(). The first test is the reported bug verbatim:
// a cover letter and a tailored CV for the same company on the same day, where
// the cover letter is NEWER. The old company-slug-only match served whichever
// was newest, so "View tailored CV" opened the cover letter.
//
// Run:  node --test tests/lib/generated-docs.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, utimesSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { findGeneratedDocs, companySlug } from "../../src/lib/generated-docs.mjs";

function makeRoot(files = {}) {
  const root = mkdtempSync(join(tmpdir(), "co-gendocs-"));
  mkdirSync(join(root, "output"), { recursive: true });
  for (const [name, ageSeconds] of Object.entries(files)) {
    const p = join(root, "output", name);
    writeFileSync(p, "x");
    // Deterministic mtimes — "newest wins" must be tested, not left to chance.
    const t = 1_800_000_000 - ageSeconds;
    utimesSync(p, t, t);
  }
  return root;
}

test("the reported bug: a NEWER cover letter must not be served as the CV", () => {
  const root = makeRoot({
    "cv-jordan-reyes-acme-foods-2026-08-23.pdf": 100, // older
    "cover-letter-jordan-reyes-acme-foods-2026-08-23.pdf": 10, // newer
  });
  try {
    const d = findGeneratedDocs(root, "Acme Foods");
    assert.match(d.cv, /^output\/cv-/, "the CV slot must hold a cv- file");
    assert.match(d.cover, /^output\/cover-letter-/);
    assert.notEqual(d.cv, d.cover);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("finds all four kinds, including the markdown drafts", () => {
  const root = makeRoot({
    "cv-jordan-reyes-acme-foods-2026-08-23.pdf": 4,
    "cover-letter-jordan-reyes-acme-foods-2026-08-23.pdf": 3,
    "email-acme-foods-2026-08-23.md": 2,
    "contacto-acme-foods-2026-08-23.md": 1,
  });
  try {
    const d = findGeneratedDocs(root, "Acme Foods");
    assert.ok(d.cv && d.cover && d.email && d.contacto, `all four should be found: ${JSON.stringify(d)}`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("picks the newest when a kind was regenerated", () => {
  const root = makeRoot({
    "cv-jordan-reyes-acme-foods-2026-08-20.pdf": 500,
    "cv-jordan-reyes-acme-foods-2026-08-23.pdf": 5,
  });
  try {
    assert.equal(findGeneratedDocs(root, "Acme Foods").cv, "output/cv-jordan-reyes-acme-foods-2026-08-23.pdf");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a company slug never matches a longer company name", () => {
  const root = makeRoot({ "cv-jordan-reyes-metabase-2026-08-23.pdf": 5 });
  try {
    assert.equal(findGeneratedDocs(root, "Meta").cv, null, "Meta must not be served Metabase's CV");
    assert.ok(findGeneratedDocs(root, "Metabase").cv);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("multi-word companies resolve to their hyphenated slug", () => {
  const root = makeRoot({ "cv-jordan-reyes-northwind-labs-2026-08-23.pdf": 5 });
  try {
    assert.ok(findGeneratedDocs(root, "Northwind Labs").cv);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("nothing generated yet yields nulls, not a throw", () => {
  const root = mkdtempSync(join(tmpdir(), "co-gendocs-empty-"));
  try {
    assert.deepEqual(findGeneratedDocs(root, "Acme Foods"), { cv: null, cover: null, email: null, contacto: null });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("an unrecognised prefix is ignored rather than mis-filed", () => {
  const root = makeRoot({ "notes-acme-foods-2026-08-23.md": 5 });
  try {
    const d = findGeneratedDocs(root, "Acme Foods");
    assert.deepEqual(d, { cv: null, cover: null, email: null, contacto: null });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("companySlug matches the generators' naming", () => {
  assert.equal(companySlug("Acme Foods"), "acme-foods");
  assert.equal(companySlug("Northwind Labs"), "northwind-labs");
  assert.equal(companySlug("Globex Insurance Group"), "globex-insurance-group");
  assert.equal(companySlug(""), "");
});
