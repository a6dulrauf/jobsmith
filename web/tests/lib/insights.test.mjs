// Tests for the insights runner: which scripts may run, how their stdout is
// parsed, and how each result is classified.
//
// The classification is the interesting part. Several career-ops analytics
// scripts REFUSE to run below a data threshold and return {error, current,
// threshold} instead of results — that is deliberate honesty, not a failure,
// and the UI has to tell those two apart or it will show "something broke"
// when the real message is "apply to 5 roles first".
//
// Run:  node --test tests/lib/insights.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { INSIGHTS, classifyResult, parseScriptJson, runInsight } from "../../src/lib/insights.mjs";

// Fake child emitting the given stdout, then exiting.
function fakeSpawn({ stdout = "", stderr = "", code = 0, failToStart = false } = {}) {
  return () => {
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    setImmediate(() => {
      if (failToStart) return child.emit("error", new Error("ENOENT"));
      if (stdout) child.stdout.emit("data", Buffer.from(stdout));
      if (stderr) child.stderr.emit("data", Buffer.from(stderr));
      child.emit("close", code);
    });
    child.kill = () => {};
    return child;
  };
}

// ── the allowlist ────────────────────────────────────────────────────────────

test("INSIGHTS: every entry has an id, script, title and explanation", () => {
  assert.ok(INSIGHTS.length >= 7);
  for (const i of INSIGHTS) {
    assert.match(i.id, /^[a-z-]+$/, `${i.id} must be a safe slug`);
    assert.match(i.script, /^[a-z-]+\.mjs$/, `${i.script} must be a bare .mjs filename`);
    assert.ok(i.title && i.what, `${i.id} needs a title and a "what this tells you"`);
  }
});

test("INSIGHTS: script names carry no path separators", () => {
  for (const i of INSIGHTS) {
    assert.ok(!i.script.includes("/") && !i.script.includes(".."), `${i.script} must not traverse`);
  }
});

// ── stdout parsing ───────────────────────────────────────────────────────────

test("parseScriptJson: parses clean JSON", () => {
  assert.deepEqual(parseScriptJson('{"a":1}'), { ok: true, data: { a: 1 } });
});

test("parseScriptJson: skips leading noise before the JSON", () => {
  // dotenv and friends print banners to stdout ahead of the payload; the
  // existing followups route does the same indexOf("{") dance.
  const out = '[dotenv] injecting env (3)\n{"tracker":{"total":1}}';
  const r = parseScriptJson(out);
  assert.equal(r.ok, true);
  assert.deepEqual(r.data, { tracker: { total: 1 } });
});

test("parseScriptJson: empty stdout is not ok", () => {
  assert.equal(parseScriptJson("").ok, false);
  assert.equal(parseScriptJson("   \n ").ok, false);
});

test("parseScriptJson: unparseable stdout is not ok", () => {
  assert.equal(parseScriptJson("total failure, no json here").ok, false);
  assert.equal(parseScriptJson("{ broken").ok, false);
});

// ── classification ───────────────────────────────────────────────────────────

test("classifyResult: a threshold refusal is 'locked', not a failure", () => {
  const r = classifyResult({
    error: 'Not enough data: 0/5 applications beyond "Evaluated". Keep applying and come back later.',
    current: 0,
    threshold: 5,
  });
  assert.equal(r.state, "locked");
  assert.equal(r.current, 0);
  assert.equal(r.threshold, 5);
  assert.match(r.message, /Not enough data/);
});

test("classifyResult: locked works when current is present but zero", () => {
  const r = classifyResult({ error: "Not enough data: 1/5 scored reports.", current: 1, threshold: 5 });
  assert.equal(r.state, "locked");
  assert.equal(r.current, 1);
});

test("classifyResult: an error without a threshold is a failure", () => {
  const r = classifyResult({ error: "portals.yml is not valid YAML" });
  assert.equal(r.state, "failed");
  assert.match(r.message, /not valid YAML/);
});

test("classifyResult: normal data is 'ready'", () => {
  const r = classifyResult({ tracker: { total: 1 }, metadata: {} });
  assert.equal(r.state, "ready");
  assert.deepEqual(r.data, { tracker: { total: 1 }, metadata: {} });
});

test("classifyResult: null/undefined is a failure, never a crash", () => {
  assert.equal(classifyResult(null).state, "failed");
  assert.equal(classifyResult(undefined).state, "failed");
});

// ── runInsight ───────────────────────────────────────────────────────────────

const SPEC = { id: "stats", script: "stats.mjs", title: "Stats", what: "…" };

test("runInsight: returns ready data on a clean run", async () => {
  const r = await runInsight({
    spec: SPEC,
    spawnFn: fakeSpawn({ stdout: '{"tracker":{"total":3}}' }),
    execPath: "node",
    root: "/tmp/x",
  });
  assert.equal(r.state, "ready");
  assert.equal(r.data.tracker.total, 3);
  assert.equal(r.id, "stats");
});

test("runInsight: a threshold refusal surfaces as locked even on exit 0", async () => {
  const r = await runInsight({
    spec: SPEC,
    spawnFn: fakeSpawn({ stdout: '{"error":"Not enough data: 0/5","current":0,"threshold":5}' }),
    execPath: "node",
    root: "/tmp/x",
  });
  assert.equal(r.state, "locked");
  assert.equal(r.threshold, 5);
});

test("runInsight: a threshold refusal on a NON-zero exit is still locked", async () => {
  // Some scripts exit non-zero when they refuse; the payload is what matters.
  const r = await runInsight({
    spec: SPEC,
    spawnFn: fakeSpawn({ stdout: '{"error":"Not enough data","current":1,"threshold":5}', code: 1 }),
    execPath: "node",
    root: "/tmp/x",
  });
  assert.equal(r.state, "locked");
});

test("runInsight: no output is a failure carrying stderr", async () => {
  const r = await runInsight({
    spec: SPEC,
    spawnFn: fakeSpawn({ stdout: "", stderr: "Cannot find module", code: 1 }),
    execPath: "node",
    root: "/tmp/x",
  });
  assert.equal(r.state, "failed");
  assert.match(r.message, /Cannot find module/);
});

test("runInsight: a spawn failure is reported, not thrown", async () => {
  const r = await runInsight({
    spec: SPEC,
    spawnFn: fakeSpawn({ failToStart: true }),
    execPath: "node",
    root: "/tmp/x",
  });
  assert.equal(r.state, "failed");
  assert.match(r.message, /ENOENT|failed to start/i);
});

test("runInsight: one slow script cannot hang the page", async () => {
  // A child that never closes must be killed and reported, not awaited forever.
  const hangingSpawn = () => {
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    let killed = false;
    child.kill = () => {
      killed = true;
      setImmediate(() => child.emit("close", null));
    };
    Object.defineProperty(child, "wasKilled", { get: () => killed });
    return child;
  };
  const r = await runInsight({
    spec: SPEC,
    spawnFn: hangingSpawn,
    execPath: "node",
    root: "/tmp/x",
    timeoutMs: 30,
  });
  assert.equal(r.state, "failed");
  assert.match(r.message, /timed out/i);
});
