// Tests for the local-calendar-date helpers.
//
// The bug being guarded: `new Date().toISOString().slice(0, 10)` returns the
// UTC date, which is YESTERDAY for the first hours of every local day east of
// Greenwich. These run under TZ=Asia/Karachi (UTC+5) and TZ=Pacific/Auckland
// (UTC+12/13) so the failure is reproduced rather than described — under the
// default TZ of a CI box in UTC, the broken and fixed versions agree and the
// test proves nothing.
//
// Run:  node --test lib/today.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));

/** Run an expression in a child process pinned to a timezone. */
function inTZ(tz, expr) {
  return execFileSync(process.execPath, ['--input-type=module', '-e', expr], {
    env: { ...process.env, TZ: tz },
    cwd: HERE,
    encoding: 'utf8',
  }).trim();
}

const IMPORT = `import { todayISO, todayDate, toLocalISODate, startOfLocalDay } from ${JSON.stringify(join(HERE, 'today.mjs'))};`;

test('the reported failure: 00:30 in Karachi is the 24th, not the 23rd', () => {
  // 2026-08-23T19:30:00Z === 2026-08-24 00:30 in Asia/Karachi (UTC+5).
  const expr = `${IMPORT}
const t = new Date('2026-08-23T19:30:00Z');
console.log(JSON.stringify({ local: todayISO(t), utc: t.toISOString().slice(0, 10) }));`;
  const { local, utc } = JSON.parse(inTZ('Asia/Karachi', expr));
  assert.equal(utc, '2026-08-23', 'sanity: the old UTC method really is a day behind here');
  assert.equal(local, '2026-08-24', 'todayISO must report the day the user is living in');
});

test('holds at an extreme positive offset (Auckland, UTC+12)', () => {
  const expr = `${IMPORT}
console.log(todayISO(new Date('2026-08-23T12:30:00Z')));`;
  assert.equal(inTZ('Pacific/Auckland', expr), '2026-08-24');
});

test('holds west of Greenwich too, where UTC runs ahead', () => {
  // 2026-08-24T03:30:00Z === 2026-08-23 20:30 in Los Angeles (UTC-7).
  const expr = `${IMPORT}
const t = new Date('2026-08-24T03:30:00Z');
console.log(JSON.stringify({ local: todayISO(t), utc: t.toISOString().slice(0, 10) }));`;
  const { local, utc } = JSON.parse(inTZ('America/Los_Angeles', expr));
  assert.equal(utc, '2026-08-24');
  assert.equal(local, '2026-08-23', 'a Californian at 8:30pm is still on the 23rd');
});

test('agrees with the old method when the machine is on UTC', () => {
  // The whole point of a surgical fix: nothing changes for anyone already
  // running in UTC, which includes CI.
  const expr = `${IMPORT}
const t = new Date('2026-08-23T19:30:00Z');
console.log(JSON.stringify([todayISO(t), t.toISOString().slice(0, 10)]));`;
  const [local, utc] = JSON.parse(inTZ('UTC', expr));
  assert.equal(local, utc);
});

test('always emits a zero-padded YYYY-MM-DD', () => {
  const expr = `${IMPORT}
console.log(todayISO(new Date(2026, 0, 5)));`;
  assert.equal(inTZ('Asia/Karachi', expr), '2026-01-05');
});

test('todayDate is local midnight, so day maths lands on whole days', () => {
  const expr = `${IMPORT}
const t = new Date('2026-08-23T19:30:00Z');
const d = todayDate(t);
console.log(JSON.stringify({ iso: toLocalISODate(d), h: d.getHours(), m: d.getMinutes() }));`;
  const r = JSON.parse(inTZ('Asia/Karachi', expr));
  assert.equal(r.iso, '2026-08-24');
  assert.equal(r.h, 0);
  assert.equal(r.m, 0);
});

test('two local midnights subtract to a whole number of days', () => {
  // Karachi: 08-23T19:30Z is the 24th, 08-30T03:05Z is the 30th → 6 days.
  const expr = `${IMPORT}
const a = startOfLocalDay(new Date('2026-08-23T19:30:00Z'));
const b = startOfLocalDay(new Date('2026-08-30T03:05:00Z'));
console.log(String((b - a) / 86400000));`;
  assert.equal(inTZ('Asia/Karachi', expr), '6');
});

test('toLocalISODate does not shift a Date built from local parts', () => {
  // new Date(2026, 7, 24) is local midnight; toISOString() would render it as
  // the 23rd in Karachi. This is the second half of the same bug.
  const expr = `${IMPORT}
const d = new Date(2026, 7, 24);
console.log(JSON.stringify({ local: toLocalISODate(d), utc: d.toISOString().slice(0, 10) }));`;
  const { local, utc } = JSON.parse(inTZ('Asia/Karachi', expr));
  assert.equal(local, '2026-08-24');
  assert.equal(utc, '2026-08-23', 'sanity: this is exactly the shift being avoided');
});
