#!/usr/bin/env node
/**
 * make-sandbox.mjs — build a throwaway career-ops install with a FICTIONAL
 * persona, so features can be verified without touching real career data.
 *
 * Why this exists: verifying career-ops end-to-end means running evaluations,
 * generating CVs and cover letters, and mutating a tracker. Doing that against
 * a real job search produces real artifacts as a side effect of testing — and
 * a generated document can carry a mistake (a guessed profile URL, say) all the
 * way to an employer. Test here instead.
 *
 * What it produces: a complete checkout (every tracked file at HEAD) plus the
 * shipped user-data fixture from test-fixtures/upgrade/<state>/ — persona
 * "Jordan Reyes" at an `example.test` address, a reserved TLD that can never
 * resolve. node_modules is symlinked, not copied.
 *
 * It also augments the fixture with extra low-fit reports, because several
 * analytics scripts refuse below a data threshold (analyze-patterns wants 5
 * applications past Evaluated; upskill wants 5 scored reports). Without those,
 * their "ready" rendering paths can never be exercised at all.
 *
 * Usage:
 *   node make-sandbox.mjs                        # ../career-ops-sandbox
 *   node make-sandbox.mjs --dir /tmp/co-sandbox
 *   node make-sandbox.mjs --state state-v1.16
 *
 * Then point tools at it:
 *   cd <sandbox> && node stats.mjs --summary
 *   CAREER_OPS_ROOT=<sandbox> npm run dev -- --port 3100    # from web/
 *
 * The sandbox is disposable. Delete it whenever; re-run this to rebuild.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));

function arg(flag, fallback) {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const target = resolve(arg("--dir", join(ROOT, "..", "career-ops-sandbox")));
const state = arg("--state", "state-v1.18");

// Refuse to build on top of the real checkout. Overwriting a live cv.md and
// tracker with fixture data is the exact accident this script exists to prevent.
if (resolve(target) === resolve(ROOT)) {
  console.error("Refusing to build the sandbox over the real checkout. Pass --dir elsewhere.");
  process.exit(1);
}
if (existsSync(join(target, ".git"))) {
  console.error(`Refusing: ${target} looks like a real git checkout, not a disposable sandbox.`);
  process.exit(1);
}

console.log(`Building sandbox at ${target} (fixture: ${state})`);
rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });

// Every tracked file at HEAD — scripts, modes, templates, web. No .git, and no
// gitignored user data, so nothing real can ride along.
const tar = execFileSync("git", ["archive", "HEAD"], { cwd: ROOT, maxBuffer: 1 << 28 });
const tmpTar = join(mkdtempSync(join(process.env.TMPDIR || "/tmp", "co-sb-")), "head.tar");
writeFileSync(tmpTar, tar);
execFileSync("tar", ["-x", "-f", tmpTar, "-C", target]);
rmSync(dirname(tmpTar), { recursive: true, force: true });

// Share node_modules rather than duplicating a few hundred MB.
const nm = join(ROOT, "node_modules");
if (existsSync(nm)) symlinkSync(nm, join(target, "node_modules"));

// Fixture user data (cv.md, profile.yml, portals.yml, tracker, reports, ...).
execFileSync("node", [join(ROOT, "seed-fixture.mjs"), target, "--state", state], { cwd: ROOT, stdio: "ignore" });

// Extra low-fit reports so threshold-gated analytics have enough to run. Gaps
// are weighted toward sub-4.0 reports, so these are deliberately low scores.
const EXTRA = [
  { n: "003", co: "Initech", slug: "initech", role: "Site Reliability Engineer", score: 3.1, gaps: ["Kubernetes", "Terraform", "Prometheus"] },
  { n: "007", co: "Vehement Capital", slug: "vehement-capital", role: "Platform Engineer", score: 3.4, gaps: ["Terraform", "Go", "Kafka"] },
  { n: "008", co: "Massive Dynamic", slug: "massive-dynamic", role: "Senior DevOps Engineer", score: 3.7, gaps: ["Kubernetes", "Helm", "Terraform"] },
  { n: "009", co: "Soylent Corp", slug: "soylent-corp", role: "Cloud Platform Engineer", score: 3.9, gaps: ["Kubernetes", "Go", "Observability"] },
];

mkdirSync(join(target, "batch", "tracker-additions"), { recursive: true });
for (const r of EXTRA) {
  const date = `2026-07-0${r.n.slice(-1)}`;
  const file = `${r.n}-${r.slug}-${date}.md`;
  writeFileSync(
    join(target, "reports", file),
    `# Evaluation: ${r.co} — ${r.role}

**Date:** ${date}
**URL:** https://example.test/jobs/${r.n}
**Archetype:** Platform Engineer
**Score:** ${r.score}/5
**Legitimacy:** High Confidence
**PDF:** pending

## Machine Summary

\`\`\`yaml
company: "${r.co}"
role: "${r.role}"
score: ${r.score}
legitimacy_tier: "High Confidence"
archetype: "Platform Engineer"
final_decision: "Consider"
hard_stops: []
soft_gaps:
${r.gaps.map((g) => `  - "No hands-on ${g} experience"`).join("\n")}
top_strengths:
  - "Backend delivery at scale"
risk_level: "Medium"
confidence: "Medium"
next_action: "Skill up before applying"
work_auth: "not_needed"
discard_reasons: []
via: null
company_confidential: false
advertised_comp: null
\`\`\`

## B) Match with CV

| Requirement | Evidence | Verdict |
|---|---|---|
${r.gaps.map((g) => `| ${g} | none found | ⚠️ gap |`).join("\n")}
`,
  );
  writeFileSync(
    join(target, "batch", "tracker-additions", `${r.n}-${r.slug}.tsv`),
    `${parseInt(r.n, 10)}\t${date}\t${r.co}\t${r.role}\tApplied\t${r.score}/5\t❌\t[${r.n}](reports/${file})\tsandbox fixture row\n`,
  );
}

// Merge through the real script, so the sandbox tracker is built the same way a
// real one is rather than hand-assembled.
execFileSync("node", ["merge-tracker.mjs"], { cwd: target, stdio: "ignore" });

console.log(`
Sandbox ready.

  cd ${target}
  node stats.mjs --summary
  node upskill.mjs --summary
  node analyze-patterns.mjs | head -40

Web UI against it (from web/):
  CAREER_OPS_ROOT=${target} npm run dev -- --port 3100

Persona is fictional (Jordan Reyes, *.example.test). Nothing here is real, and
nothing real is reachable from here.`);
