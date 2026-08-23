// Tests for parseSalaryAsk(). The rule these protect is that a HALF-parsed
// recommendation must come back as null: a salary card showing a range with no
// single number, or a number with no currency, is worse than no card, because
// the user acts on it in a live conversation with a recruiter.
//
// Run:  node --test tests/lib/salary-ask.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSalaryAsk, formatMoney } from "../../src/lib/salary-ask.mjs";

const report = (askYaml) => `# Evaluation: Acme Foods — Senior React Native Engineer

**Date:** 2026-08-13
**Score:** 4.5/5

---

## Machine Summary

\`\`\`yaml
company: "Acme Foods"
role: "Senior React Native Engineer"
score: 4.5
advertised_comp: "not stated"
${askYaml}
\`\`\`

## A) Role Summary
Body text.
`;

const FULL = `salary_ask:
  currency: "EUR"
  period: "year"
  basis: "gross"
  range_low: 240000
  range_high: 300000
  single_number: 285000
  floor: 210000
  confidence: "Medium"
  anchored_to: "Lisbon, Portugal"
  rationale: "Lisbon senior RN band, Levels.fyi + local job boards; matched at senior."
  script_call: "Based on the Lisbon market for senior React Native roles and the scope here, I'm looking at 240,000 to 300,000 EUR gross. Happy to talk through the whole package."
  script_text: "Based on the Lisbon market for senior React Native roles, I am targeting 240,000-300,000 EUR gross per year, open to discussing the full package."
  script_text_single: "285,000 EUR gross per year, with flexibility depending on the overall package."`;

test("parses a complete recommendation", () => {
  const a = parseSalaryAsk(report(FULL));
  assert.equal(a.currency, "EUR");
  assert.equal(a.rangeLow, 240000);
  assert.equal(a.rangeHigh, 300000);
  assert.equal(a.singleNumber, 285000);
  assert.equal(a.floor, 210000);
  assert.equal(a.confidence, "Medium");
  assert.equal(a.anchoredTo, "Lisbon, Portugal");
  assert.equal(a.period, "year");
  assert.equal(a.basis, "gross");
});

test("the anchor is the ROLE's market, not the candidate's home", () => {
  // The candidate is in Karachi; the role is in Lisbon and pays Lisbon money.
  // Anchoring on the candidate's own market is the single most costly mistake
  // this feature exists to prevent, so the field is surfaced, never derived.
  const a = parseSalaryAsk(report(FULL));
  assert.equal(a.anchoredTo, "Lisbon, Portugal");
  assert.ok(!/karachi|pakistan|pkr/i.test(JSON.stringify(a)));
});

test("null when the evaluation could not research a number", () => {
  assert.equal(parseSalaryAsk(report("salary_ask: null")), null);
});

test("null when the report has no Machine Summary at all", () => {
  assert.equal(parseSalaryAsk("# Evaluation\n\nJust prose, no summary."), null);
});

test("a missing single number makes the whole thing null", () => {
  const partial = `salary_ask:
  currency: "EUR"
  range_low: 70000
  range_high: 90000`;
  assert.equal(parseSalaryAsk(report(partial)), null, "a range with no form-ready figure is half a recommendation");
});

test("a missing currency makes the whole thing null", () => {
  const partial = `salary_ask:
  range_low: 70000
  range_high: 90000
  single_number: 85000`;
  assert.equal(parseSalaryAsk(report(partial)), null, "a bare number with no currency is unusable");
});

test("an inverted range is rejected rather than displayed backwards", () => {
  const bad = `salary_ask:
  currency: "EUR"
  range_low: 90000
  range_high: 70000
  single_number: 85000`;
  assert.equal(parseSalaryAsk(report(bad)), null);
});

test("malformed YAML returns null instead of throwing", () => {
  const broken = "# R\n\n## Machine Summary\n\n```yaml\ncompany: \"x\n  bad: [unclosed\n```\n";
  assert.equal(parseSalaryAsk(broken), null);
});

test("an unknown confidence value degrades to Low, never to trusted", () => {
  const a = parseSalaryAsk(report(FULL.replace('"Medium"', '"Extremely High"')));
  assert.equal(a.confidence, "Low");
});

test("period and basis default conservatively", () => {
  const minimal = `salary_ask:
  currency: "AED"
  range_low: 300000
  range_high: 380000
  single_number: 360000`;
  const a = parseSalaryAsk(report(minimal));
  assert.equal(a.period, "year");
  assert.equal(a.basis, "gross");
  assert.equal(a.floor, null);
});

test("formatMoney survives a currency code Intl rejects", () => {
  // Intl accepts any well-formed 3-letter code and simply prints it, so an
  // unfamiliar market currency still renders. It throws RangeError on a
  // MALFORMED code, which an evaluation could emit from a typo — and a report
  // page must not go blank over a salary label.
  assert.match(formatMoney(285000, "EUR"), /285,000/);
  assert.match(formatMoney(285000, "XYZ"), /285,000/);
  assert.match(formatMoney(285000, "TOOLONG"), /285,000\s*TOOLONG/);
});

test("the three registers are parsed separately", () => {
  const a = parseSalaryAsk(report(FULL));
  assert.match(a.scriptText, /240,000-300,000 EUR/);
  assert.match(a.scriptTextSingle, /^285,000 EUR/, "the single-figure variant leads with the number");
  assert.match(a.scriptCall, /Happy to talk/);
});

test("a written script stays inside a typical form field cap", () => {
  // Salary fields are frequently capped; a truncated answer reads worse than a
  // short one, so the mode asks for ~200 chars and this guards the shape.
  const a = parseSalaryAsk(report(FULL));
  assert.ok(a.scriptText.length <= 200, `scriptText was ${a.scriptText.length} chars`);
});

test("no scripts written yet leaves the numbers usable", () => {
  const a = parseSalaryAsk(report(`salary_ask:
  currency: "EUR"
  range_low: 70000
  range_high: 90000
  single_number: 85000`));
  assert.equal(a.scriptText, null);
  assert.equal(a.scriptCall, null);
  assert.equal(a.singleNumber, 85000, "missing prose must not invalidate the figures");
});

test("a script never leaks the candidate's own market", () => {
  const a = parseSalaryAsk(report(FULL));
  const prose = [a.scriptCall, a.scriptText, a.scriptTextSingle].join(" ");
  assert.ok(!/karachi|pakistan|\bPKR\b|current salary/i.test(prose));
});
