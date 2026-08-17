// Tests for readProfileNarrative()/readModeDoc().
// These read user-layer files that are frequently absent or half-written during
// onboarding, so totality (never throw) is the property under test.
//
// Run:  node --test tests/lib/profile-view.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { readProfileNarrative, readModeDoc } from "../../src/lib/profile-view.mjs";

const PROFILE = `
candidate:
  full_name: "Jane Smith"
target_roles:
  primary:
    - "Senior Full-Stack Engineer"
  archetypes:
    - name: "Full-Stack Engineer"
      level: "Senior"
      fit: "primary"
      sell_when: "JD wants end-to-end ownership"
narrative:
  headline: "Full-stack engineer"
  exit_story: "Six years in, ready for scale."
  superpowers:
    - "Legacy-to-modern migrations"
  proof_points:
    - name: "Expo migration"
      hero_metric: "~33% smaller"
location:
  country: "Pakistan"
  needs_sponsorship: true
spend_tier: standard
`;

function makeRoot(profileYaml = PROFILE) {
  const root = mkdtempSync(join(tmpdir(), "co-profile-"));
  mkdirSync(join(root, "config"), { recursive: true });
  mkdirSync(join(root, "modes"), { recursive: true });
  if (profileYaml !== null) writeFileSync(join(root, "config", "profile.yml"), profileYaml);
  return root;
}

test("readProfileNarrative: extracts the presentation slice", () => {
  const root = makeRoot();
  try {
    const p = readProfileNarrative(root);
    assert.equal(p.exists, true);
    assert.equal(p.valid, true);
    assert.equal(p.headline, "Full-stack engineer");
    assert.equal(p.exitStory, "Six years in, ready for scale.");
    assert.deepEqual(p.superpowers, ["Legacy-to-modern migrations"]);
    assert.equal(p.archetypes.length, 1);
    assert.equal(p.archetypes[0].sell_when, "JD wants end-to-end ownership");
    assert.deepEqual(p.primaryRoles, ["Senior Full-Stack Engineer"]);
    assert.equal(p.spendTier, "standard");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("readProfileNarrative: an empty exit_story reads as null, not empty string", () => {
  const root = makeRoot('narrative:\n  exit_story: ""\n');
  try {
    assert.equal(readProfileNarrative(root).exitStory, null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("readProfileNarrative: commented-out compensation reads as unset", () => {
  const root = makeRoot();
  try {
    assert.equal(readProfileNarrative(root).compensationSet, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("readProfileNarrative: a populated compensation block reads as set", () => {
  const root = makeRoot('compensation:\n  target_range: "EUR 70-90K"\n');
  try {
    assert.equal(readProfileNarrative(root).compensationSet, true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("readProfileNarrative: missing file does not throw", () => {
  const root = makeRoot(null);
  try {
    const p = readProfileNarrative(root);
    assert.equal(p.exists, false);
    assert.equal(p.valid, false);
    assert.deepEqual(p.archetypes, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("readProfileNarrative: malformed YAML is reported invalid, raw text preserved", () => {
  const root = makeRoot("narrative:\n  headline: 'unterminated\n    - [oops\n");
  try {
    const p = readProfileNarrative(root);
    assert.equal(p.exists, true);
    assert.equal(p.valid, false);
    assert.ok(p.raw.includes("unterminated"), "raw text must survive for display");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("readModeDoc: reads a whitelisted doc", () => {
  const root = makeRoot();
  try {
    writeFileSync(join(root, "modes", "_brief.md"), "# Triage Brief");
    const d = readModeDoc(root, "_brief.md");
    assert.equal(d.exists, true);
    assert.match(d.content, /Triage Brief/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("readModeDoc: refuses anything not on the whitelist", () => {
  const root = makeRoot();
  try {
    writeFileSync(join(root, "modes", "oferta.md"), "system mode");
    assert.equal(readModeDoc(root, "oferta.md").exists, false);
    assert.equal(readModeDoc(root, "../config/profile.yml").exists, false);
    assert.equal(readModeDoc(root, "_shared.md").exists, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("readModeDoc: absent file reports exists:false without throwing", () => {
  const root = makeRoot();
  try {
    assert.equal(readModeDoc(root, "_custom.md").exists, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
