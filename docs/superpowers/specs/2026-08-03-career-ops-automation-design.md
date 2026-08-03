# Unattended scan loop + digest delivery for career-ops

**Date:** 2026-08-03
**Status:** Approved design, pending implementation plan

## Problem

career-ops is a decision-support system that only works while you are sitting in
front of it. Nothing runs on its own. `docs/AUTOMATION.md` ships scheduling
recipes and a triage prompt, but they are documentation — no code wires them
together, and the result of a scan stays in a file nobody opens.

A second project, [kbarbab/Jobseeker-AI](https://github.com/kbarbab/Jobseeker-AI),
solves exactly that: a GitHub Actions cron that scans, tailors, and emails a
digest twice daily. It is otherwise a strict subset of career-ops (single
`base_resume.json`, ~7 aggregators, fpdf2 rendering, no ghost-job detection, no
fact gates, no license).

This design takes the one thing Jobseeker-AI does better and adds it to
career-ops, using career-ops's own architecture.

## Decision: extend career-ops in place

Rejected alternatives:

- **Fork or merge the two codebases.** Forking freezes the checkout at v1.24.0
  and gives up `update-system.mjs`, which is actively maintained and ships
  migration tests plus rollback. Merging additionally requires reconciling
  Python↔Node, fpdf2↔Playwright, and `base_resume.json`↔`cv.md` — pure cost,
  since career-ops's side of each pair is the stronger one.
- **A separate sibling repo that shells into career-ops.** Avoids the fork
  problem but duplicates config resolution, has no access to `pipeline-lock.mjs`,
  and puts the scheduling layer out of sync with the data contract it depends on.

Extending in place is safe because of how the updater works (verified, not
assumed — see Constraints).

## Constraints derived from `update-system.mjs`

`update-system.mjs` overwrites an explicit `SYSTEM_PATHS` allowlist via
`git checkout FETCH_HEAD -- <path>`, and prunes deleted files **only** under
`tests/` and `test-fixtures/`, and only when git-tracked. Therefore:

| Action | Survives an update? |
|---|---|
| New file outside `tests/` and `test-fixtures/` | ✅ Yes |
| Edit to a file listed in `SYSTEM_PATHS` (`package.json`, `.env.example`, `modes/_shared.md`, `.github/`) | ❌ Reverted |
| New file *added* under `.github/` that upstream does not ship | ✅ Yes (checkout does not delete extras) |
| New file under `tests/` or `test-fixtures/` | ❌ Pruned |
| `.env`, `config/`, `data/`, `portals.yml` (user layer) | ✅ Yes |

Three hard rules follow:

1. **Zero new npm dependencies.** `package.json` is updater-managed, so a
   dependency added there disappears on the next update. This matches existing
   house practice — `img-to-pdf.mjs` explicitly notes it adds none.
2. **New files only. No modifications to any existing tracked file.**
3. **Secrets live in `.env`** (gitignored, absent from `SYSTEM_PATHS`); source
   configuration lives in `portals.yml` (user layer).

## Non-goals

- Auto-applying, auto-submitting, or auto-sending anything to an employer. The
  loop's terminal action is delivering a shortlist to the user.
- Evaluating postings unattended. Full A–G evaluation stays user-initiated;
  the loop stops at triage.
- Replacing or duplicating `modes/triage.md`. The loop invokes it.
- Tailoring CVs unattended.
- Any web UI or dashboard work.

## Components

### 1. `providers/adzuna.mjs`, `providers/jooble.mjs`

**Purpose:** two additional job sources, matching Jobseeker-AI's aggregator
coverage.

**Interface:** the existing provider contract, verified in
`providers/_registry.mjs`:

```js
export default { id: 'adzuna', async fetch(entry, ctx) { /* → [{title,url,company,location}] */ } }
```

`loadProviders()` auto-registers any non-`_`-prefixed `.mjs` in `providers/`
alphabetically and skips malformed modules non-fatally. **`scan.mjs` requires no
edit.** Wired in through `job_boards:` entries in `portals.yml`.

**Dependencies:** `providers/_http.mjs` (`ctx.fetchJson`, which passes `method`
and `body` through, so Jooble's POST API is supported), and
`providers/_trust-validator.mjs`, consistent with sibling providers.

**Keys:** `ADZUNA_APP_ID` + `ADZUNA_APP_KEY`, `JOOBLE_API_KEY`. All free tier.

**Behaviour on missing key:** log once, return `[]`, never throw. A scan must not
die because an optional aggregator is unconfigured.

**Honest expected value:** low. Both are aggregators that largely re-list
postings career-ops already fetches directly from Greenhouse/Lever/Ashby, and it
already ships RemoteOK, Remotive, Himalayas, Arbeitnow, and TheMuse. Dedup will
absorb most of their output. They are included for coverage completeness, not
because they are expected to change outcomes.

### 2. `shortlist-digest.mjs`

**Purpose:** deliver the triage result to the user through whichever sink is
available.

**Interface:** `node shortlist-digest.mjs [--sink=auto|email|notify|stdout] [--json] [--summary]`

`--json` / `--summary` dual output follows the convention in `stats.mjs`,
`salary-gap.mjs`, `detect-reposts.mjs`, and `process-quality.mjs`, so the digest
composes with the rest of the toolchain rather than being a dead end.

**Sink resolution under `--sink=auto`:**

1. `DIGEST_SMTP_USER` + `DIGEST_SMTP_PASS` + `DIGEST_TO` all present → email
2. else `process.platform === 'darwin'` → `osascript` notification
3. else → stdout, and append to `data/loop.log`

**SMTP:** hand-rolled over the built-in `node:tls` module (implicit TLS,
port 465, `AUTH LOGIN`, multipart plain + HTML). No dependency.

**Input:** `data/shortlist.md`, plus a status object from `scan-loop.mjs`.

**Failure honesty (the most important behaviour in this design):** when an
upstream stage failed, the digest reports the failure instead of sending an empty
shortlist. A silent empty digest reads as "no jobs today" when it may mean
"broken for nine days" — that failure mode is the one that quietly wastes months.

**Security:** every interpolated field (company, title, location, note) is
third-party untrusted data under AGENTS.md's Untrusted External Content rule.
All are HTML-escaped before entering the HTML part, following
`build-cv-html.mjs`'s `escapeHtml`. Header-injection characters (CR/LF) are
stripped from subject and address fields.

### 3. `scan-loop.mjs`

**Purpose:** the single entry point both launchd and GitHub Actions call. `.mjs`,
not shell — the repo has exactly one shell script (`batch/batch-runner.sh`).

**Interface:** `node scan-loop.mjs [--weekly] [--dry-run] [--triage-limit=N] [--json]`

**Stages:**

| Stage | Command | Notes |
|---|---|---|
| Preflight | `doctor.mjs --json` | Bail with an explanatory digest if `onboardingNeeded` |
| Scan | `scan.mjs` | Title/location filters already apply here |
| Wide sweep | `scan-ats-full.mjs` | `--weekly` only; a long sweep would dominate a daily run |
| Triage | `claude -p` → `modes/triage.md` | Reads `modes/_brief.md` only, by design |
| Deliver | `shortlist-digest.mjs` | Sink resolved as above |

**Who writes `data/shortlist.md`:** `modes/triage.md` states it writes no files,
and this design does not change that. The `claude -p` invocation returns triage
verdicts on stdout; `scan-loop.mjs` parses that output and writes
`data/shortlist.md` itself. The mode stays a pure evaluator; the loop owns
persistence. A malformed or empty model response is a stage failure, not an empty
shortlist.

**Bounded triage cost:** `modes/triage.md` fetches the JD for each posting, so
cost scales with queue depth. `--triage-limit` (default 25) caps postings per
run, ordered newest-first. Rows beyond the cap stay pending for the next run and
are **never silently dropped** — the digest states how many were deferred.
Without this bound, one wide `--weekly` sweep could trigger hundreds of WebFetch
calls and full-context evaluations in a single unattended run.

**Concurrency:** takes the pipeline lock via `pipeline-lock.mjs`
(`withPipelineLock`). A scheduled scan firing while the user is mid-session in
their CLI is exactly the race that module exists to prevent.

**Error handling:** stages are independent. A non-fatal stage failure is recorded
in the status object and the loop continues, so one dead aggregator does not cost
the user their digest. All output appends to `data/loop.log`.

**Runtime-agnostic:** every input comes from env or config. No host assumptions,
no hardcoded paths. This is what makes Phase 2 a configuration change rather than
a rewrite.

### 4. `templates/io.career-ops.loop.plist`

launchd agent template using `StartCalendarInterval`, so a Mac asleep at the
scheduled hour runs on wake. `templates/` is where career-ops keeps templates.

### 5. `.github/workflows/career-ops-loop.yml` (Phase 2, dormant)

Ships with `workflow_dispatch` only — no `schedule:` trigger. Calls the same
`scan-loop.mjs`. The user flips it on if and when they accept the tradeoff that
`cv.md` and the tracker must then live in a (private) repo with the Claude token
and API keys as Actions secrets — a tradeoff career-ops was explicitly built to
avoid, which is why this is opt-in and off.

### 6. `docs/LOOP.md`

Setup, `.env` reference, the launchd install/uninstall commands, the Phase 2
switch, and a runbook for the three realistic failure modes (SMTP auth rejected,
`claude -p` unavailable or rate-limited, doctor reporting incomplete onboarding).

## Data flow

```
launchd (or Actions)
  └─ scan-loop.mjs ── withPipelineLock
       ├─ doctor.mjs --json ............... abort → digest("not set up")
       ├─ scan.mjs ........................ data/pipeline.md  (+ scan-history dedup)
       ├─ scan-ats-full.mjs (--weekly) .... data/pipeline.md
       ├─ claude -p → modes/triage.md ..... data/shortlist.md
       └─ shortlist-digest.mjs ............ email | notification | stdout
                                             └─ data/loop.log
```

## Testing

Tests go at repo root following the house convention (`*.test.mjs` /
`*-tests.mjs`), **not** under `tests/`, which the updater prunes.

`shortlist-digest.test.mjs`:
- Shortlist parsing: populated, empty, malformed, missing file
- Sink selection matrix: SMTP vars complete / partial / absent × darwin / linux
- SMTP wire format asserted against a fake socket — never a live send
- HTML escaping: a company or title containing `<script>`, `&`, quotes
- Header injection: CR/LF in subject or address fields is stripped
- Failure honesty: a failed upstream stage produces a failure digest, not an
  empty-shortlist digest

`scan-loop.test.mjs`:
- Preflight abort when `doctor.mjs` reports `onboardingNeeded`
- A failing stage is recorded and does not abort later stages
- `--weekly` gates the wide sweep; a default run skips it
- `--dry-run` performs no writes and sends nothing
- `--triage-limit` caps processed rows, defers the remainder, and reports the
  deferred count — asserted with a queue larger than the cap
- A malformed or empty `claude -p` response is a stage failure, not an empty
  shortlist
- The pipeline lock is held across the scan and triage stages

Provider tests use recorded fixtures — no live network. Both providers must also
pass the repo's existing meta-validators (`validate-untrusted-content-coverage.mjs`,
`validate-system-paths-coverage.mjs`).

## Prerequisites and sequencing

The loop cannot be meaningfully tested before onboarding: preflight reads
`doctor.mjs`, triage requires a filled-in `modes/_brief.md`, and the digest
requires a shortlist derived from `config/profile.yml`.

More importantly, **automating an uncalibrated filter makes things worse.** A
daily email of 300 irrelevant rows gets ignored within a week. `title_filter`
quality is unknown until a real scan has run.

Sequence:

1. `npm install` — done 2026-08-03 (playwright 1.61.0 → 1.62.0)
2. Onboarding — `cv.md`, `config/profile.yml`, `portals.yml`, `modes/_brief.md`
3. One live scan plus a few real evaluations — calibrate `title_filter`
4. Implement this design against filters known to work

Steps 2–3 are user-facing and do not block writing the implementation plan.

## Success criteria

- A scheduled run with no human present produces either a shortlist digest or an
  explicit failure digest — never silence, never a misleading empty digest.
- `node update-system.mjs apply` leaves every file in this design intact.
- No new npm dependency appears in `package.json`.
- Nothing in the loop submits, sends, or applies to an employer.
