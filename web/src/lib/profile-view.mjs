// profile-view.mjs — read-only view of the files that decide how the candidate
// is presented: config/profile.yml's narrative block, the archetypes that select
// a CV framing, and the two markdown files the CLI reads (modes/_profile.md and
// modes/_brief.md).
//
// These are user-layer files the web app must never write — config/profile.yml's
// own API route refuses to touch archetypes/narrative precisely because a
// careless merge would destroy them. This module is the read half of that
// contract: it surfaces them so the user can see what the system believes about
// them, and offers no way to change it from the browser.
//
// Every function is total: a missing or malformed file yields an empty/partial
// result rather than throwing, because a half-configured project is the normal
// state during onboarding, not an error.
//
// Plain .mjs so `node --test` can import it directly.

import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";

/** Markdown files from modes/ that this view is allowed to read. */
const MODE_DOCS = new Set(["_profile.md", "_brief.md", "_custom.md"]);

function readIfPresent(abs) {
  try {
    return fs.readFileSync(abs, "utf8");
  } catch {
    return null;
  }
}

/**
 * Read a whitelisted markdown doc out of modes/.
 * @returns {{name: string, content: string, exists: boolean}}
 */
export function readModeDoc(root, name) {
  if (!MODE_DOCS.has(name)) return { name, content: "", exists: false };
  const content = readIfPresent(path.join(root, "modes", name));
  return { name, content: content ?? "", exists: content !== null };
}

/**
 * Parse the presentation-relevant slice of config/profile.yml.
 * Returns nulls/empties rather than throwing when the file is absent or invalid.
 *
 * @returns {{
 *   exists: boolean, valid: boolean,
 *   headline: string|null, exitStory: string|null,
 *   superpowers: string[], proofPoints: Array<{name: string, hero_metric?: string, url?: string}>,
 *   archetypes: Array<{name: string, level?: string, fit?: string, track?: string, sell_when?: string}>,
 *   primaryRoles: string[],
 *   location: Record<string, unknown>|null,
 *   compensationSet: boolean,
 *   spendTier: string|null,
 *   raw: string
 * }}
 */
export function readProfileNarrative(root) {
  const file = path.join(root, "config", "profile.yml");
  const raw = readIfPresent(file);
  const empty = {
    exists: raw !== null,
    valid: false,
    headline: null,
    exitStory: null,
    superpowers: [],
    proofPoints: [],
    archetypes: [],
    primaryRoles: [],
    location: null,
    compensationSet: false,
    spendTier: null,
    raw: raw ?? "",
  };
  if (raw === null) return empty;

  let doc;
  try {
    doc = yaml.load(raw);
  } catch {
    return empty; // invalid YAML — show the raw text, claim nothing about it
  }
  if (!doc || typeof doc !== "object") return empty;

  const narrative = doc.narrative && typeof doc.narrative === "object" ? doc.narrative : {};
  const targets = doc.target_roles && typeof doc.target_roles === "object" ? doc.target_roles : {};
  const comp = doc.compensation;

  const str = (v) => (typeof v === "string" && v.trim() !== "" ? v : null);
  const arr = (v) => (Array.isArray(v) ? v : []);

  return {
    exists: true,
    valid: true,
    headline: str(narrative.headline),
    exitStory: str(narrative.exit_story),
    superpowers: arr(narrative.superpowers).filter((s) => typeof s === "string"),
    proofPoints: arr(narrative.proof_points).filter((p) => p && typeof p === "object"),
    archetypes: arr(targets.archetypes).filter((a) => a && typeof a === "object"),
    primaryRoles: arr(targets.primary).filter((s) => typeof s === "string"),
    location: doc.location && typeof doc.location === "object" ? doc.location : null,
    // A commented-out compensation block is a deliberate state ("unassessed"),
    // not a mistake — the UI says so explicitly rather than showing a blank.
    compensationSet: Boolean(comp && typeof comp === "object" && Object.keys(comp).length > 0),
    spendTier: str(doc.spend_tier),
    raw,
  };
}
