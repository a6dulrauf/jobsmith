/**
 * today.mjs — what calendar day is it, for the person using this?
 *
 * Every date this system stores is a CIVIL DATE, not an instant: `applied
 * 2026-08-24`, a follow-up due `2026-08-31`, a report filename
 * `001-hellofresh-2026-08-13.md`. None of them carries a time or a zone, and
 * none of them should — "the day I applied" is a fact about the user's
 * calendar, not about a moment on a global timeline.
 *
 * The bug this replaces: thirty-odd scripts derived that day from
 * `new Date().toISOString().slice(0, 10)`, which is the UTC date. For anyone
 * east of Greenwich that is yesterday for the first hours of every local day —
 * five hours daily at UTC+5, eleven at UTC+11. The user hits it as
 * `set-status.mjs --on 2026-08-24` being rejected as "in the future" on the
 * morning of the 24th, and as a freshly-recorded application showing
 * `daysSinceApplication: -1`.
 *
 * Storing UTC and converting on display — the usual advice — does not fix this,
 * because there is nothing to convert: a bare `2026-08-23` has no time of day
 * to shift. Making it convertible would mean turning every stored date into a
 * timestamp, which changes the tracker columns, the TSV contract, and every
 * report filename. The narrower and correct fix is to ask the local clock what
 * day it is, since local-first is what this application already is.
 *
 * Where UTC remains right, and is deliberately left alone:
 *   - log timestamps (`created_at`), which really are instants
 *   - isRealCalendarDate(), which round-trips a GIVEN date string through UTC
 *     to validate it — no "now" involved, so no drift
 */

/**
 * Today's date in the local timezone as `YYYY-MM-DD`.
 *
 * `en-CA` is the shortest correct spelling of an ISO-8601 date formatter:
 * that locale's short date format IS `YYYY-MM-DD`, and it reads the local zone
 * by default. Building the string from getFullYear/getMonth/getDate by hand
 * gives the same answer and needs zero-padding logic to get right.
 *
 * @param {Date} [now] injectable for tests
 * @returns {string} e.g. "2026-08-24"
 */
export function todayISO(now = new Date()) {
  return now.toLocaleDateString('en-CA');
}

/**
 * Today as a Date pinned to local midnight — the shape day-difference maths
 * wants, so that subtracting two of them yields whole days rather than a
 * fraction that floors unpredictably depending on the time of day.
 *
 * @param {Date} [now] injectable for tests
 * @returns {Date}
 */
export function todayDate(now = new Date()) {
  return startOfLocalDay(now);
}

/**
 * Midnight local time on the day containing `d`.
 * @param {Date} d
 * @returns {Date}
 */
export function startOfLocalDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Format any Date as a local `YYYY-MM-DD`. Use for a Date built from local
 * parts — `toISOString()` would shift it across the date line for most of the
 * world's timezones.
 *
 * @param {Date} d
 * @returns {string}
 */
export function toLocalISODate(d) {
  return d.toLocaleDateString('en-CA');
}
