#!/usr/bin/env node
/**
 * fix-skills.mjs — repair the per-CLI skill entrypoints.
 *
 * Every supported CLI finds the skill through `.{cli}/skills/career-ops/SKILL.md`,
 * which ships as a symlink to the canonical `.agents/skills/career-ops/SKILL.md`.
 * Windows does not create symlinks by default, so git checks those out as plain
 * pointer files containing a path instead of the skill — and the CLI then loads
 * nothing.
 *
 * Upstream's fix was a side effect of `update-system.mjs apply`, which calls
 * ensureSkillEntrypoints() as one of its steps. This fork disables that updater
 * (it would overwrite the fork's identity), which would have left Windows users
 * with no way to repair their entrypoints at all. This script exposes the same
 * function directly, so the capability survives the fork.
 *
 * Usage:
 *   node fix-skills.mjs           # repair anything broken
 *   node fix-skills.mjs --check   # report only, change nothing
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, lstatSync, readFileSync } from "node:fs";

const ROOT = dirname(fileURLToPath(import.meta.url));
const checkOnly = process.argv.includes("--check");

const { SKILL_ENTRYPOINTS, CANONICAL_SKILL_PATH, ensureSkillEntrypoints } = await import(
  "./scaffolder/bin/skill-entrypoints.mjs"
);

const canonical = join(ROOT, CANONICAL_SKILL_PATH);
if (!existsSync(canonical)) {
  console.error(`Canonical skill is missing: ${CANONICAL_SKILL_PATH}\nThis checkout is incomplete — re-clone it.`);
  process.exit(1);
}

/** A working entrypoint is a symlink, or a real copy of the canonical content.
 *  A short file holding a relative path is the Windows pointer-file failure. */
function inspect(rel) {
  const abs = join(ROOT, rel);
  if (!existsSync(abs)) return "missing";
  try {
    if (lstatSync(abs).isSymbolicLink()) return "symlink";
  } catch {
    return "unreadable";
  }
  const body = readFileSync(abs, "utf8");
  if (body.length < 200 && body.includes("SKILL.md")) return "pointer-file";
  return "materialized";
}

// Entries are { path, pointer } objects, not bare strings.
const before = SKILL_ENTRYPOINTS.map((e) => ({ rel: e.path, state: inspect(e.path) }));
const broken = before.filter((e) => e.state === "pointer-file" || e.state === "missing" || e.state === "unreadable");

for (const e of before) {
  const ok = e.state === "symlink" || e.state === "materialized";
  console.log(`  ${ok ? "ok  " : "BAD "} ${e.state.padEnd(14)} ${e.rel}`);
}

if (broken.length === 0) {
  console.log(`\nAll ${before.length} skill entrypoints are working. Nothing to do.`);
  process.exit(0);
}

if (checkOnly) {
  console.log(`\n${broken.length} entrypoint(s) need repair. Re-run without --check to fix them.`);
  process.exit(1);
}

const fixed = ensureSkillEntrypoints(ROOT);
const after = SKILL_ENTRYPOINTS.map((e) => e.path).filter((rel) => {
  const s = inspect(rel);
  return s === "pointer-file" || s === "missing" || s === "unreadable";
});

console.log(`\nRepaired ${Array.isArray(fixed) ? fixed.length : broken.length - after.length} entrypoint(s).`);
if (after.length) {
  console.error(`Still broken: ${after.join(", ")}`);
  process.exit(1);
}
console.log("All skill entrypoints are working now.");
