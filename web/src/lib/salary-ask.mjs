// Read the `salary_ask` recommendation out of a report's Machine Summary.
//
// Block D of an evaluation works out what the EMPLOYER is likely to pay. Block
// D2 answers the question the candidate is actually asked — "what are your
// salary expectations?" — which is the one number a job search cannot avoid and
// the one nobody can look up quickly: it depends on the role, the seniority
// actually matched, the city, the currency, and the company type.
//
// This module only reads. The number is produced by the evaluation, where the
// research happens; inventing or adjusting one here would be a figure with no
// traceable basis, which is precisely what Block D2 forbids.

import yaml from "js-yaml";

/** Pull the YAML fence that follows the `## Machine Summary` heading. */
function machineSummary(md) {
  if (typeof md !== "string") return null;
  const head = md.search(/^##\s+Machine Summary\s*$/m);
  if (head === -1) return null;
  // First fenced block after the heading. Language tag optional — reports use
  // ```yaml but a stray ``` should not silently drop the whole summary.
  const fence = md.slice(head).match(/```[a-zA-Z]*\n([\s\S]*?)```/);
  if (!fence) return null;
  try {
    const doc = yaml.load(fence[1]);
    return doc && typeof doc === "object" ? doc : null;
  } catch {
    return null; // a malformed summary is missing data, not a crash
  }
}

const CONFIDENCE = new Set(["High", "Medium", "Low"]);

/**
 * @typedef {object} SalaryAsk
 * @property {string} currency      ISO code as written by the evaluation
 * @property {"year"|"month"} period
 * @property {"gross"|"net"} basis
 * @property {number} rangeLow
 * @property {number} rangeHigh
 * @property {number} singleNumber  the one figure for forms that reject a range
 * @property {number|null} floor    walk-away figure
 * @property {"High"|"Medium"|"Low"} confidence
 * @property {string|null} anchoredTo  the market the figure is anchored to
 * @property {string|null} rationale
 */

/**
 * @param {string} md  full report markdown
 * @returns {SalaryAsk|null} null when absent, malformed, or missing the numbers
 *   that make it actionable — a partial recommendation is worse than none.
 */
export function parseSalaryAsk(md) {
  const ms = machineSummary(md);
  const a = ms?.salary_ask;
  if (!a || typeof a !== "object") return null;

  const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const rangeLow = num(a.range_low);
  const rangeHigh = num(a.range_high);
  const singleNumber = num(a.single_number);

  // All three are load-bearing: the range is what you negotiate within, the
  // single number is what a form demands. Missing either makes the card lie.
  if (rangeLow === null || rangeHigh === null || singleNumber === null) return null;
  if (rangeHigh < rangeLow) return null;

  const currency = typeof a.currency === "string" ? a.currency.trim().toUpperCase() : "";
  if (!currency) return null;

  return {
    currency,
    period: a.period === "month" ? "month" : "year",
    basis: a.basis === "net" ? "net" : "gross",
    rangeLow,
    rangeHigh,
    singleNumber,
    floor: num(a.floor),
    confidence: /** @type {"High"|"Medium"|"Low"} */ (CONFIDENCE.has(a.confidence) ? a.confidence : "Low"),
    anchoredTo: typeof a.anchored_to === "string" && a.anchored_to.trim() ? a.anchored_to.trim() : null,
    rationale: typeof a.rationale === "string" && a.rationale.trim() ? a.rationale.trim() : null,
  };
}

/**
 * Money for display. Intl handles digit grouping per currency, but throws on an
 * unrecognised code — an evaluation can legitimately produce one for a market
 * Intl does not know, and that must not take the page down.
 * @param {number} n
 * @param {string} currency
 */
export function formatMoney(n, currency) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n)} ${currency}`;
  }
}
