// insights.mjs — run career-ops' analytics scripts and classify what comes back.
//
// Every script here already emits --json and costs nothing to run: they read
// local files, call no model, and touch no network. The web layer does not
// reimplement any of their logic — it runs the same script the CLI runs and
// renders the verdict, so the two can never disagree.
//
// The classification is the substance of this module. Several of these scripts
// deliberately REFUSE below a data threshold, returning {error, current,
// threshold} rather than inventing a pattern from three data points. That is
// the scripts being honest, and it is a completely different thing from a
// script that broke. Conflating them would either hide real breakage or make a
// correctly-empty page look broken, so "locked" is a first-class state here.
//
// spawnFn is injected so all of this is testable without subprocesses.

import path from "node:path";

/** The scripts this page may run. A hardcoded allowlist of bare filenames —
 *  nothing from a request ever reaches the argv. */
export const INSIGHTS = [
  {
    id: "stats",
    script: "stats.mjs",
    title: "Lifetime funnel",
    what: "Every application you have ever tracked, by stage — how many you evaluated, applied to, heard back from, and interviewed for.",
  },
  {
    id: "patterns",
    script: "analyze-patterns.mjs",
    title: "Rejection patterns",
    what: "Where applications die, and your advance rate per ATS vendor. Finding you convert three times better through one channel changes where you spend effort.",
  },
  {
    id: "upskill",
    script: "upskill.mjs",
    title: "Skill gaps",
    what: "Which skills keep appearing in jobs you want but are missing from your CV, weighted by how often they come up.",
  },
  {
    id: "reposts",
    script: "detect-reposts.mjs",
    title: "Ghost jobs & reposts",
    what: "Roles re-listed repeatedly in a 90-day window. Frequent reposting is a ghost-job signal worth knowing before you spend an evening applying.",
  },
  {
    id: "salary-gap",
    script: "salary-gap.mjs",
    title: "Salary gap",
    what: "Your target versus what postings advertise versus what you are actually offered.",
  },
  {
    id: "velocity",
    script: "funnel-velocity.mjs",
    title: "Funnel velocity",
    what: "How long applications sit at each stage, and which are overdue a nudge.",
  },
  {
    id: "process-quality",
    script: "process-quality.mjs",
    title: "Recruiting friction",
    what: "Per-company friction from your own interview notes — who wastes your time.",
  },
];

/**
 * Extract a JSON payload from a script's stdout.
 * Tolerates leading noise: dotenv and similar print banners ahead of the
 * payload, which is why the existing followups route also scans for the first
 * brace rather than parsing the whole buffer.
 *
 * @param {string} stdout
 * @returns {{ok: true, data: any} | {ok: false}}
 */
export function parseScriptJson(stdout) {
  if (typeof stdout !== "string" || stdout.trim() === "") return { ok: false };
  const start = stdout.indexOf("{");
  if (start === -1) return { ok: false };
  try {
    return { ok: true, data: JSON.parse(stdout.slice(start)) };
  } catch {
    return { ok: false };
  }
}

/**
 * Decide what a parsed payload means.
 *
 * `{error, threshold}` is a script declining to guess — surface it as "locked"
 * with its progress so the UI can say "3 of 5, keep applying". A bare `error`
 * with no threshold is a genuine failure.
 *
 * @param {any} data
 * @returns {{state: "ready", data: any} | {state: "locked", message: string, current: number|null, threshold: number|null} | {state: "failed", message: string}}
 */
export function classifyResult(data) {
  if (!data || typeof data !== "object") {
    return { state: "failed", message: "The script returned nothing usable." };
  }
  if (typeof data.error === "string") {
    if (typeof data.threshold === "number") {
      return {
        state: "locked",
        message: data.error,
        current: typeof data.current === "number" ? data.current : null,
        threshold: data.threshold,
      };
    }
    return { state: "failed", message: data.error };
  }
  return { state: "ready", data };
}

/**
 * Run one insight script and classify the result. Never throws and never hangs:
 * a script that dies, prints garbage, or stalls becomes a "failed" card, so one
 * bad script cannot take the page down with it.
 *
 * @param {{spec: object, spawnFn: Function, execPath: string, root: string, timeoutMs?: number}} args
 */
export function runInsight({ spec, spawnFn, execPath, root, timeoutMs = 20_000 }) {
  return new Promise((resolve) => {
    const done = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ id: spec.id, title: spec.title, what: spec.what, ...result });
    };
    let settled = false;
    let stdout = "";
    let stderr = "";

    let child;
    try {
      child = spawnFn(execPath, [path.join(root, spec.script), "--json"], { cwd: root });
    } catch (e) {
      return done({ state: "failed", message: `failed to start: ${e instanceof Error ? e.message : String(e)}` });
    }

    const timer = setTimeout(() => {
      try {
        child.kill("SIGTERM");
      } catch {
        /* already gone */
      }
      done({ state: "failed", message: `${spec.script} timed out after ${Math.round(timeoutMs / 1000)}s.` });
    }, timeoutMs);

    child.stdout?.on("data", (d) => {
      stdout += d.toString();
    });
    child.stderr?.on("data", (d) => {
      stderr += d.toString();
    });
    child.on("error", (e) => done({ state: "failed", message: `failed to start: ${e.message}` }));
    child.on("close", () => {
      // Exit code is deliberately not consulted: some scripts exit non-zero
      // when they refuse below a threshold, and that payload is exactly what we
      // want to show. The payload decides, not the exit status.
      const parsed = parseScriptJson(stdout);
      if (!parsed.ok) {
        const detail = stderr.trim().split("\n").slice(-2).join(" ").slice(0, 200);
        return done({ state: "failed", message: detail || "The script produced no JSON output." });
      }
      done(classifyResult(parsed.data));
    });
  });
}

/**
 * Run every insight concurrently. They are independent reads, so there is no
 * reason to serialize them.
 *
 * @param {{spawnFn: Function, execPath: string, root: string, timeoutMs?: number}} args
 */
export function runAllInsights({ spawnFn, execPath, root, timeoutMs = 20_000 }) {
  return Promise.all(INSIGHTS.map((spec) => runInsight({ spec, spawnFn, execPath, root, timeoutMs })));
}
