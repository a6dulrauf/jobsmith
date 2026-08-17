# Mode: update — DISABLED in this fork

Jobsmith is a **hard fork** of [career-ops](https://github.com/santifer/career-ops).
There is no automatic update mechanism, and `update-system.mjs` refuses to run.

## Why

The updater pulls upstream files over an explicit `SYSTEM_PATHS` allowlist. That
list includes `README.md`, `package.json`, `AGENTS.md`, `CLAUDE.md` and
`LICENSE` — every file carrying this fork's identity. Running it would restore
career-ops's branding over Jobsmith's, silently, and undo the fork.

The script is kept on disk rather than deleted because the test suite reads its
`SYSTEM_PATHS` array to prove no system file is unregistered — a check worth
keeping. It exits non-zero with an explanation if invoked.

## What to do when the user asks about updates

Say plainly that this fork does not auto-update, and that upstream changes are
taken deliberately, one at a time:

```bash
git remote add upstream https://github.com/santifer/career-ops.git   # once
git fetch upstream
git log upstream/main --oneline           # review what is new
git show <sha>                            # read the change before taking it
git cherry-pick <sha>
```

Good candidates to bring over: new or repaired provider modules under
`providers/`, fixes to evaluation modes, scanner bug fixes. These rarely
conflict, because this fork changed almost nothing outside `web/`.

Poor candidates: anything touching `README.md`, `package.json`, `AGENTS.md`,
`CLAUDE.md`, `LICENSE` or `.gitignore` — those carry fork-specific content and
will conflict by design.

After any cherry-pick, run both suites before trusting the result:

```bash
node test-all.mjs          # core
cd web && npm test         # portal
```

## What is NOT lost

Nothing about how the system works day to day. Evaluation, scanning, tailoring,
tracking and every mode behave exactly as upstream — this fork did not modify
`modes/`, `providers/`, `templates/`, or any engine script. What is gone is only
the convenience of `npm run update` and `npm run rollback`.

Rolling back a bad cherry-pick is ordinary git:

```bash
git revert <sha>            # keeps history
git reset --hard HEAD~1     # discards it, if not yet pushed
```
