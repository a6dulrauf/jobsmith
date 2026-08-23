// Tests for computeSteps() — the "what do I do next" decision.
//
// The ordering is the substance here. Each step is blocked by the one above it,
// so the test that matters is: given a half-set-up install, does it name the
// FIRST real blocker rather than something further down the list?
//
// Run:  node --test tests/lib/next-step.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { computeSteps } from "../../src/lib/next-step.mjs";

const READY = {
  hasCli: true, hasCv: true, hasProfile: true, hasPortals: true,
  inboxCount: 392, reportCount: 1, pdfCount: 1, appliedCount: 1, outcomeCount: 1,
  topReport: { n: "1", company: "HelloFresh", score: "4.5/5" },
};
const state = (o) => ({ ...READY, ...o });

test("a brand-new install is sent to pick an AI assistant first", () => {
  const r = computeSteps(state({ hasCli: false, hasCv: false, hasProfile: false, hasPortals: false, inboxCount: 0, reportCount: 0, pdfCount: 0, appliedCount: 0, outcomeCount: 0 }));
  assert.equal(r.next.id, "cli");
});

test("the real reported failure: everything set up EXCEPT the CLI", () => {
  // This is exactly what happened — 392 jobs, a CV, a scored report, and
  // "Score shortlist" failing with "AI not setup" because a browser-side setting
  // was never made. The flow must surface that, not a later step.
  const r = computeSteps(state({ hasCli: false }));
  assert.equal(r.next.id, "cli");
  assert.equal(r.next.blocking, true);
  assert.match(r.next.href, /config/);
});

test("with a CLI but no CV, the CV comes next", () => {
  const r = computeSteps(state({ hasCv: false, reportCount: 0, pdfCount: 0, appliedCount: 0, outcomeCount: 0 }));
  assert.equal(r.next.id, "cv");
});

test("jobs found but none scored → scoring, with the steps spelled out", () => {
  const r = computeSteps(state({ reportCount: 0, pdfCount: 0, appliedCount: 0, outcomeCount: 0 }));
  assert.equal(r.next.id, "score");
  // The "how" is the whole point: Inbox → tick → Save → Score shortlist is not
  // discoverable, and no label in that path says "evaluate".
  assert.ok(Array.isArray(r.next.how) && r.next.how.length >= 3);
  assert.ok(r.next.how.some((h) => /Score shortlist/.test(h)));
});

test("an empty inbox asks for a scan before asking for a score", () => {
  const r = computeSteps(state({ inboxCount: 0, reportCount: 0, pdfCount: 0, appliedCount: 0, outcomeCount: 0 }));
  assert.equal(r.next.id, "scan");
});

test("a scored job with no PDF points at that exact report, by name", () => {
  const r = computeSteps(state({ pdfCount: 0, appliedCount: 0, outcomeCount: 0 }));
  assert.equal(r.next.id, "cv-pdf");
  assert.match(r.next.title, /HelloFresh/);
  assert.equal(r.next.href, "/pipeline/1");
});

test("documents ready but nothing applied → send it", () => {
  const r = computeSteps(state({ appliedCount: 0, outcomeCount: 0 }));
  assert.equal(r.next.id, "apply");
  assert.ok(r.next.how.some((h) => /company site/i.test(h)));
});

test("applied but no outcome recorded → record it", () => {
  const r = computeSteps(state({ outcomeCount: 0 }));
  assert.equal(r.next.id, "outcome");
});

test("a fully caught-up install reports done rather than inventing work", () => {
  const r = computeSteps(READY);
  assert.equal(r.next, null);
  assert.equal(r.allDone, true);
  assert.equal(r.doneCount, r.total);
});

test("missing topReport never produces a broken link", () => {
  const r = computeSteps(state({ pdfCount: 0, appliedCount: 0, outcomeCount: 0, topReport: null }));
  assert.equal(r.next.href, "/pipeline");
  assert.ok(!r.next.href.includes("null") && !r.next.href.includes("undefined"));
});

test("every step carries a reason, an action and a destination", () => {
  // A step without a "why" is the failure being fixed: a button with no
  // explanation is what made the portal unusable cold.
  for (const s of computeSteps(READY).steps) {
    assert.ok(s.title && s.why && s.cta && s.href, `${s.id} is missing a field`);
    assert.ok(s.why.length > 40, `${s.id}'s reason is too thin to help`);
  }
});

test("progress counts only completed steps", () => {
  const r = computeSteps(state({ hasCli: false, appliedCount: 0, outcomeCount: 0 }));
  assert.equal(r.doneCount, r.steps.filter((s) => s.done).length);
  assert.ok(r.doneCount < r.total);
});
