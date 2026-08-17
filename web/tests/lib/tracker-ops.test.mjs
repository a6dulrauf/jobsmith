// Tests for the outcome-recording and tracker-maintenance runners.
//
// Both spawn career-ops scripts with arguments derived from HTTP requests, so
// the argument validation is the security boundary: an unvalidated selector or
// outcome type would reach argv directly.
//
// Run:  node --test tests/lib/tracker-ops.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import {
  OUTCOME_TYPES,
  MAINTENANCE_OPS,
  buildOutcomeArgs,
  runMaintenance,
  runOutcome,
} from "../../src/lib/tracker-ops.mjs";

function fakeSpawn({ stdout = "", stderr = "", code = 0, failToStart = false } = {}) {
  const calls = [];
  const fn = (exec, args) => {
    calls.push({ exec, args });
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.kill = () => {};
    setImmediate(() => {
      if (failToStart) return child.emit("error", new Error("ENOENT"));
      if (stdout) child.stdout.emit("data", Buffer.from(stdout));
      if (stderr) child.stderr.emit("data", Buffer.from(stderr));
      child.emit("close", code);
    });
    return child;
  };
  fn.calls = calls;
  return fn;
}

// ── the allowlists ───────────────────────────────────────────────────────────

test("OUTCOME_TYPES: matches outcome.mjs's documented set", () => {
  const ids = OUTCOME_TYPES.map((o) => o.id).sort();
  assert.deepEqual(ids, [
    "hired",
    "interview_only",
    "interview_progress",
    "no_response",
    "offer_declined",
    "offer_received",
    "rejected",
  ]);
  for (const o of OUTCOME_TYPES) assert.ok(o.label, `${o.id} needs a human label`);
});

test("MAINTENANCE_OPS: every op names a bare script and declares whether it writes", () => {
  for (const op of MAINTENANCE_OPS) {
    assert.match(op.script, /^[a-z-]+\.mjs$/, `${op.script} must be a bare filename`);
    assert.equal(typeof op.mutates, "boolean", `${op.id} must declare whether it mutates`);
    assert.ok(op.label && op.what);
  }
  // verify-pipeline is the read-only one; it must not be marked as mutating,
  // because the UI uses that flag to decide whether to demand confirmation.
  const verify = MAINTENANCE_OPS.find((o) => o.script === "verify-pipeline.mjs");
  assert.equal(verify.mutates, false);
});

// ── argument construction ────────────────────────────────────────────────────

test("buildOutcomeArgs: builds args for a valid request", () => {
  const r = buildOutcomeArgs({ n: "7", type: "rejected", note: "auto-rejected day 2" });
  assert.equal(r.ok, true);
  assert.deepEqual(r.args, ["7", "rejected", "--json", "--note", "auto-rejected day 2"]);
});

test("buildOutcomeArgs: omits optional flags when absent", () => {
  const r = buildOutcomeArgs({ n: "3", type: "hired" });
  assert.deepEqual(r.args, ["3", "hired", "--json"]);
});

test("buildOutcomeArgs: rejects a non-numeric selector", () => {
  for (const bad of ["../7", "7;rm -rf /", "abc", "", "7 8", "--help"]) {
    assert.equal(buildOutcomeArgs({ n: bad, type: "hired" }).ok, false, `"${bad}" must be rejected`);
  }
});

test("buildOutcomeArgs: rejects an outcome type not on the allowlist", () => {
  for (const bad of ["fired", "--json", "rejected;ls", "", "REJECTED"]) {
    assert.equal(buildOutcomeArgs({ n: "1", type: bad }).ok, false, `"${bad}" must be rejected`);
  }
});

test("buildOutcomeArgs: refuses free-text fields that look like flags", () => {
  // A note beginning with "--" would be parsed as an option by the script.
  const r = buildOutcomeArgs({ n: "1", type: "hired", note: "--force" });
  assert.equal(r.ok, false);
  assert.match(r.error, /cannot start with/i);
});

test("buildOutcomeArgs: passes stage and feedback through when valid", () => {
  const r = buildOutcomeArgs({ n: "1", type: "interview_progress", stage: "onsite", feedback: "went well" });
  assert.ok(r.args.includes("--stage") && r.args.includes("onsite"));
  assert.ok(r.args.includes("--feedback") && r.args.includes("went well"));
});

// ── runOutcome ───────────────────────────────────────────────────────────────

test("runOutcome: parses the script's JSON on success", async () => {
  const spawnFn = fakeSpawn({ stdout: '{"ok":true,"state":"Hired"}' });
  const r = await runOutcome({ spawnFn, execPath: "node", root: "/r", n: "1", type: "hired" });
  assert.equal(r.ok, true);
  assert.equal(r.data.state, "Hired");
  // The bare filename must be joined to the root, never taken from input.
  assert.match(spawnFn.calls[0].args[0], /\/r\/outcome\.mjs$/);
});

test("runOutcome: invalid input never spawns anything", async () => {
  const spawnFn = fakeSpawn();
  const r = await runOutcome({ spawnFn, execPath: "node", root: "/r", n: "../1", type: "hired" });
  assert.equal(r.ok, false);
  assert.equal(spawnFn.calls.length, 0, "must not spawn on invalid input");
});

test("runOutcome: flags caller-input failures as `invalid` so routes can answer 400", async () => {
  // Every validation rejection must carry the flag — the route uses it instead of
  // matching error prose, which previously mapped a rejected note to a 500.
  const spawnFn = fakeSpawn();
  for (const bad of [
    { n: "../1", type: "hired" },
    { n: "1", type: "fired" },
    { n: "1", type: "hired", note: "--force" },
    { n: "1", type: "hired", stage: "-x" },
  ]) {
    const r = await runOutcome({ spawnFn, execPath: "node", root: "/r", ...bad });
    assert.equal(r.ok, false, `${JSON.stringify(bad)} should fail`);
    assert.equal(r.invalid, true, `${JSON.stringify(bad)} should be flagged invalid`);
  }
});

test("runOutcome: a genuine script failure is NOT flagged invalid", async () => {
  // Otherwise a broken script would be reported to the user as their mistake.
  const spawnFn = fakeSpawn({ stderr: "boom", code: 1 });
  const r = await runOutcome({ spawnFn, execPath: "node", root: "/r", n: "1", type: "hired" });
  assert.equal(r.ok, false);
  assert.notEqual(r.invalid, true);
});

test("runOutcome: a non-zero exit with JSON still surfaces the payload", async () => {
  // outcome.mjs prints a JSON reason even when it fails, with --json.
  const spawnFn = fakeSpawn({ stdout: '{"ok":false,"reason":"not-found"}', code: 1 });
  const r = await runOutcome({ spawnFn, execPath: "node", root: "/r", n: "99", type: "hired" });
  assert.equal(r.ok, false);
  assert.equal(r.data.reason, "not-found");
});

test("runOutcome: no output at all reports stderr", async () => {
  const spawnFn = fakeSpawn({ stderr: "boom", code: 1 });
  const r = await runOutcome({ spawnFn, execPath: "node", root: "/r", n: "1", type: "hired" });
  assert.equal(r.ok, false);
  assert.match(r.error, /boom/);
});

// ── runMaintenance ───────────────────────────────────────────────────────────

test("runMaintenance: runs an allowlisted op and returns its raw output", async () => {
  const spawnFn = fakeSpawn({ stdout: "Pipeline is clean!" });
  const r = await runMaintenance({ spawnFn, execPath: "node", root: "/r", id: "verify" });
  assert.equal(r.ok, true);
  assert.match(r.output, /Pipeline is clean/);
});

test("runMaintenance: refuses an id not on the allowlist", async () => {
  const spawnFn = fakeSpawn();
  for (const bad of ["../../etc/passwd", "rm", "", "scan"]) {
    const r = await runMaintenance({ spawnFn, execPath: "node", root: "/r", id: bad });
    assert.equal(r.ok, false, `"${bad}" must be refused`);
  }
  assert.equal(spawnFn.calls.length, 0, "must never spawn for an unknown id");
});

test("runMaintenance: keeps output even when the script exits non-zero", async () => {
  // verify-pipeline exits non-zero when it finds problems — that output is the
  // whole point, so it must not be discarded as a failure.
  const spawnFn = fakeSpawn({ stdout: "2 errors found", code: 1 });
  const r = await runMaintenance({ spawnFn, execPath: "node", root: "/r", id: "verify" });
  assert.match(r.output, /2 errors found/);
  assert.equal(r.exitCode, 1);
});
