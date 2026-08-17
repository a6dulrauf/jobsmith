// tracker-ops.mjs — record application outcomes and run tracker maintenance.
//
// Both halves spawn career-ops scripts with arguments derived from an HTTP
// request, so argument validation is the security boundary here: the report
// selector, the outcome type, and the maintenance op id are all checked against
// exact shapes or allowlists before anything reaches argv. Free-text fields are
// additionally refused if they begin with "--", which would otherwise be parsed
// as options by the script rather than values.
//
// No logic is reimplemented — outcome.mjs and the maintenance scripts remain
// the single source of truth, and this module only runs them and relays what
// they say.
//
// spawnFn is injected for testability.

import path from "node:path";

/** The outcomes outcome.mjs accepts, with labels for the UI. Kept in sync with
 *  OUTCOME_MAP in outcome.mjs — a value not in this list never reaches argv. */
export const OUTCOME_TYPES = [
  { id: "interview_progress", label: "Moved to interview", hint: "Sets status to Interview" },
  { id: "interview_only", label: "Interviewed, no offer", hint: "Interviewed but it ended there" },
  { id: "offer_received", label: "Offer received", hint: "Sets status to Offer" },
  { id: "hired", label: "Hired 🎉", hint: "Terminal success" },
  { id: "offer_declined", label: "Declined their offer", hint: "You said no" },
  { id: "rejected", label: "Rejected", hint: "They said no" },
  { id: "no_response", label: "Ghosted", hint: "No reply at all" },
];

/** Tracker maintenance operations. `mutates` drives whether the UI demands a
 *  confirmation, so it must be accurate. None of these take user input — the id
 *  selects a fixed script and there are no other arguments. */
export const MAINTENANCE_OPS = [
  {
    id: "verify",
    script: "verify-pipeline.mjs",
    label: "Check pipeline health",
    what: "Read-only audit: duplicate rows, orphan reports, broken report links, inconsistent Via channels.",
    mutates: false,
  },
  {
    id: "merge",
    script: "merge-tracker.mjs",
    label: "Merge pending additions",
    what: "Folds any pending TSVs in batch/tracker-additions/ into the tracker. Safe to re-run; it is idempotent.",
    mutates: true,
  },
  {
    id: "normalize",
    script: "normalize-statuses.mjs",
    label: "Normalize statuses",
    what: "Rewrites non-canonical status values to the ones in templates/states.yml.",
    mutates: true,
  },
  {
    id: "dedup",
    script: "dedup-tracker.mjs",
    label: "Deduplicate rows",
    what: "Collapses rows describing the same opening. Uses fuzzy title matching, so review the output.",
    mutates: true,
  },
];

const OUTCOME_IDS = new Set(OUTCOME_TYPES.map((o) => o.id));

/** Free-text values must not be mistakable for an option. */
function badFreeText(value, name) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") return `${name} must be a string.`;
  if (value.startsWith("-")) return `${name} cannot start with "-" — it would be read as an option.`;
  if (value.includes("\0")) return `${name} contains a null byte.`;
  return null;
}

/**
 * Build argv for outcome.mjs, or explain why the request is invalid.
 *
 * @param {{n: string, type: string, stage?: string, feedback?: string, note?: string}} req
 * @returns {{ok: true, args: string[]} | {ok: false, error: string}}
 */
export function buildOutcomeArgs({ n, type, stage, feedback, note }) {
  if (typeof n !== "string" || !/^\d+$/.test(n)) {
    return { ok: false, error: `Invalid application number: "${n}"` };
  }
  if (typeof type !== "string" || !OUTCOME_IDS.has(type)) {
    return { ok: false, error: `Unknown outcome type: "${type}"` };
  }
  for (const [value, name] of [
    [stage, "stage"],
    [feedback, "feedback"],
    [note, "note"],
  ]) {
    const err = badFreeText(value, name);
    if (err) return { ok: false, error: err };
  }
  const args = [n, type, "--json"];
  if (stage) args.push("--stage", stage);
  if (feedback) args.push("--feedback", feedback);
  if (note) args.push("--note", note);
  return { ok: true, args };
}

/** Collect a child's stdout/stderr and resolve — never throws, never hangs. */
function collect({ spawnFn, execPath, args, root, timeoutMs }) {
  return new Promise((resolve) => {
    let settled = false;
    let stdout = "";
    let stderr = "";
    const done = (r) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(r);
    };
    let child;
    try {
      child = spawnFn(execPath, args, { cwd: root });
    } catch (e) {
      return done({ stdout: "", stderr: `failed to start: ${e instanceof Error ? e.message : String(e)}`, code: null });
    }
    const timer = setTimeout(() => {
      try {
        child.kill("SIGTERM");
      } catch {
        /* already gone */
      }
      done({ stdout, stderr: `${stderr}\ntimed out after ${Math.round(timeoutMs / 1000)}s`, code: null });
    }, timeoutMs);
    child.stdout?.on("data", (d) => {
      stdout += d.toString();
    });
    child.stderr?.on("data", (d) => {
      stderr += d.toString();
    });
    child.on("error", (e) => done({ stdout, stderr: `failed to start: ${e.message}`, code: null }));
    child.on("close", (code) => done({ stdout, stderr, code }));
  });
}

/**
 * Record an application outcome via outcome.mjs.
 *
 * outcome.mjs prints a JSON payload with --json even when it fails, so the
 * payload is preferred over the exit code for explaining what happened.
 */
export async function runOutcome({ spawnFn, execPath, root, n, type, stage, feedback, note, timeoutMs = 30_000 }) {
  const built = buildOutcomeArgs({ n, type, stage, feedback, note });
  // `invalid` marks a caller-input problem so the route can answer 400 without
  // pattern-matching error prose — string-matching message prefixes silently
  // mapped a rejected note to a 500 (a server fault) instead.
  if (!built.ok) return { ok: false, invalid: true, error: built.error };

  const { stdout, stderr, code } = await collect({
    spawnFn,
    execPath,
    args: [path.join(root, "outcome.mjs"), ...built.args],
    root,
    timeoutMs,
  });

  const start = stdout.indexOf("{");
  if (start !== -1) {
    try {
      const data = JSON.parse(stdout.slice(start));
      // The payload's own ok flag wins; fall back to the exit code when absent.
      const ok = typeof data.ok === "boolean" ? data.ok : code === 0;
      return { ok, data, exitCode: code };
    } catch {
      /* fall through to the stderr path */
    }
  }
  return {
    ok: false,
    error: stderr.trim().split("\n").slice(-3).join(" ").slice(0, 300) || "outcome.mjs produced no output.",
    exitCode: code,
  };
}

/**
 * Run one allowlisted maintenance script and return its raw output.
 *
 * These scripts have no --json mode, so their human-readable output is relayed
 * verbatim rather than reshaped — inventing structure would risk misreporting
 * what the script actually said. A non-zero exit is NOT treated as failure:
 * verify-pipeline exits non-zero precisely when it has findings to show.
 */
export async function runMaintenance({ spawnFn, execPath, root, id, timeoutMs = 60_000 }) {
  const op = MAINTENANCE_OPS.find((o) => o.id === id);
  if (!op) return { ok: false, error: `Unknown maintenance operation: "${id}"` };

  const { stdout, stderr, code } = await collect({
    spawnFn,
    execPath,
    args: [path.join(root, op.script)],
    root,
    timeoutMs,
  });

  const output = [stdout.trim(), stderr.trim()].filter(Boolean).join("\n").slice(0, 20_000);
  return { ok: true, id: op.id, label: op.label, mutates: op.mutates, exitCode: code, output: output || "(no output)" };
}
