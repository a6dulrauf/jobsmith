// Tests for validateCoverPayload()/renderCoverLetter().
//
// spawnFn is injected, so these exercise the full success and failure paths
// without launching Playwright or a real subprocess.
//
// Run:  node --test tests/lib/cover-render.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { validateCoverPayload, renderCoverLetter } from "../../src/lib/cover-render.mjs";

const GOOD = {
  candidate: { name: "Abdul Rauf", email: "a@example.com" },
  letter: { role_title: "Senior React Native Engineer", opening: "…", profile_intro: "…" },
};

function tmp() {
  return mkdtempSync(join(tmpdir(), "co-cover-"));
}

// A fake child process that exits with `code`, optionally writing the PDF.
function fakeSpawn({ code = 0, stderr = "", writePdf = null, failToStart = false } = {}) {
  return () => {
    const child = new EventEmitter();
    child.stderr = new EventEmitter();
    setImmediate(() => {
      if (failToStart) return child.emit("error", new Error("ENOENT"));
      if (stderr) child.stderr.emit("data", Buffer.from(stderr));
      if (writePdf) writeFileSync(writePdf, "%PDF-1.4 rendered");
      child.emit("close", code);
    });
    return child;
  };
}

// ── validateCoverPayload ─────────────────────────────────────────────────────

test("validateCoverPayload: accepts a complete payload", () => {
  const dir = tmp();
  try {
    const p = join(dir, "payload.json");
    writeFileSync(p, JSON.stringify(GOOD));
    assert.equal(validateCoverPayload(p).ok, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("validateCoverPayload: missing file is an actionable error, not a throw", () => {
  const dir = tmp();
  try {
    const r = validateCoverPayload(join(dir, "nope.json"));
    assert.equal(r.ok, false);
    assert.match(r.error, /didn't produce a cover-letter payload/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("validateCoverPayload: empty file is rejected", () => {
  const dir = tmp();
  try {
    const p = join(dir, "payload.json");
    writeFileSync(p, "   ");
    assert.match(validateCoverPayload(p).error, /empty/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("validateCoverPayload: malformed JSON is rejected", () => {
  const dir = tmp();
  try {
    const p = join(dir, "payload.json");
    writeFileSync(p, "{not json");
    assert.match(validateCoverPayload(p).error, /wasn't valid JSON/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("validateCoverPayload: names the specific missing field", () => {
  const dir = tmp();
  try {
    const p = join(dir, "payload.json");
    writeFileSync(p, JSON.stringify({ candidate: { name: "A" }, letter: { role_title: "X", opening: "y" } }));
    assert.match(validateCoverPayload(p).error, /letter\.profile_intro/);

    writeFileSync(p, JSON.stringify({ letter: GOOD.letter }));
    assert.match(validateCoverPayload(p).error, /candidate/);

    writeFileSync(p, JSON.stringify({ candidate: {}, letter: GOOD.letter }));
    assert.match(validateCoverPayload(p).error, /candidate\.name/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── renderCoverLetter ────────────────────────────────────────────────────────

test("renderCoverLetter: happy path returns the rendered filename", async () => {
  const dir = tmp();
  try {
    const payload = join(dir, "payload.json");
    const finalPdf = join(dir, "cover-letter-abdul-rauf-hellofresh-2026-08-17.pdf");
    writeFileSync(payload, JSON.stringify(GOOD));
    const r = await renderCoverLetter({
      spawnFn: fakeSpawn({ code: 0, writePdf: finalPdf }),
      execPath: "node",
      root: dir,
      coverPaths: { payload, finalPdf },
    });
    assert.equal(r.kind, "ok");
    assert.equal(r.pdf, "cover-letter-abdul-rauf-hellofresh-2026-08-17.pdf");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("renderCoverLetter: bad payload short-circuits before spawning", async () => {
  const dir = tmp();
  try {
    let spawned = false;
    const r = await renderCoverLetter({
      spawnFn: () => {
        spawned = true;
        return fakeSpawn()();
      },
      execPath: "node",
      root: dir,
      coverPaths: { payload: join(dir, "missing.json"), finalPdf: join(dir, "out.pdf") },
    });
    assert.equal(r.kind, "invalid-payload");
    assert.equal(spawned, false, "must not launch a browser for an invalid payload");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("renderCoverLetter: non-zero exit surfaces stderr", async () => {
  const dir = tmp();
  try {
    const payload = join(dir, "payload.json");
    writeFileSync(payload, JSON.stringify(GOOD));
    const r = await renderCoverLetter({
      spawnFn: fakeSpawn({ code: 1, stderr: "template missing" }),
      execPath: "node",
      root: dir,
      coverPaths: { payload, finalPdf: join(dir, "out.pdf") },
    });
    assert.equal(r.kind, "render-failed");
    assert.match(r.error, /template missing/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("renderCoverLetter: clean exit that produced no PDF is still a failure", async () => {
  const dir = tmp();
  try {
    const payload = join(dir, "payload.json");
    writeFileSync(payload, JSON.stringify(GOOD));
    const r = await renderCoverLetter({
      spawnFn: fakeSpawn({ code: 0 }), // exits 0 but writes nothing
      execPath: "node",
      root: dir,
      coverPaths: { payload, finalPdf: join(dir, "out.pdf") },
    });
    assert.equal(r.kind, "render-failed");
    assert.match(r.error, /produced no PDF/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("renderCoverLetter: spawn failure is reported, not thrown", async () => {
  const dir = tmp();
  try {
    const payload = join(dir, "payload.json");
    writeFileSync(payload, JSON.stringify(GOOD));
    const r = await renderCoverLetter({
      spawnFn: fakeSpawn({ failToStart: true }),
      execPath: "node",
      root: dir,
      coverPaths: { payload, finalPdf: join(dir, "out.pdf") },
    });
    assert.equal(r.kind, "render-failed");
    assert.match(r.error, /failed to start/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
