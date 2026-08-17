// cover-render.mjs — render a cover-letter payload to PDF from the web app.
//
// Mirrors pdf-render.mjs's contract deliberately. The agent writes only the
// JSON payload that modes/cover.md specifies; this module renders it. That
// split exists because rendering launches a real browser, which an agent CLI's
// own sandbox may block with no human present to approve the escalation (#2172)
// — the backend is a plain Node process with no such sandbox.
//
// spawnFn is injected so the whole thing is testable without launching a
// browser or a real subprocess, same as pdf-render.mjs.

import fs from "node:fs";
import path from "node:path";

/**
 * Validate the payload the agent wrote before spending a browser launch on it.
 * generate-cover-letter.mjs enforces the same required keys, but failing here
 * gives the user an actionable message instead of a stack trace from a
 * subprocess, and avoids a pointless Playwright start-up.
 *
 * @param {string} payloadPath
 * @returns {{ok: true, payload: object} | {ok: false, error: string}}
 */
export function validateCoverPayload(payloadPath) {
  let raw;
  try {
    raw = fs.readFileSync(payloadPath, "utf8");
  } catch {
    return { ok: false, error: "The run didn't produce a cover-letter payload, so nothing was rendered — re-run it to verify." };
  }
  if (!raw.trim()) {
    return { ok: false, error: "The cover-letter payload was empty — re-run it to verify." };
  }
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch (e) {
    return { ok: false, error: `The cover-letter payload wasn't valid JSON: ${e instanceof Error ? e.message : String(e)}` };
  }
  // Same required keys generate-cover-letter.mjs asserts on.
  if (!payload?.candidate || typeof payload.candidate !== "object") {
    return { ok: false, error: "Cover-letter payload is missing the `candidate` block." };
  }
  if (!payload.candidate.name) {
    return { ok: false, error: "Cover-letter payload is missing `candidate.name`." };
  }
  if (!payload?.letter || typeof payload.letter !== "object") {
    return { ok: false, error: "Cover-letter payload is missing the `letter` block." };
  }
  for (const key of ["role_title", "opening", "profile_intro"]) {
    if (!payload.letter[key]) {
      return { ok: false, error: `Cover-letter payload is missing \`letter.${key}\`.` };
    }
  }
  return { ok: true, payload };
}

/**
 * Spawn generate-cover-letter.mjs and resolve once it exits.
 *
 * @param {{spawnFn: Function, execPath: string, root: string, payload: string, finalPdf: string}} args
 * @returns {Promise<{ok: boolean, stderr: string}>}
 */
export function spawnGenerateCoverLetter({ spawnFn, execPath, root, payload, finalPdf }) {
  return new Promise((resolve) => {
    const child = spawnFn(
      execPath,
      [path.join(root, "generate-cover-letter.mjs"), "--payload", payload, "--out", finalPdf],
      { cwd: root },
    );
    let stderr = "";
    child.stderr.on("data", (d) => {
      stderr += d.toString();
    });
    child.on("close", (code) => resolve({ ok: code === 0, stderr: stderr.trim() }));
    child.on("error", (e) =>
      resolve({ ok: false, stderr: `Cover-letter rendering failed to start: ${e.message}` }),
    );
  });
}

/**
 * Validate then render. Returns a discriminated result the route can turn
 * straight into a stream message.
 *
 * @param {{spawnFn: Function, execPath: string, root: string, coverPaths: {payload: string, finalPdf: string}}} args
 * @returns {Promise<{kind: "ok", pdf: string} | {kind: "invalid-payload" | "render-failed", error: string}>}
 */
export async function renderCoverLetter({ spawnFn, execPath, root, coverPaths }) {
  const check = validateCoverPayload(coverPaths.payload);
  if (!check.ok) return { kind: "invalid-payload", error: check.error };

  const result = await spawnGenerateCoverLetter({
    spawnFn,
    execPath,
    root,
    payload: coverPaths.payload,
    finalPdf: coverPaths.finalPdf,
  });
  if (!result.ok) {
    return { kind: "render-failed", error: result.stderr || "Cover-letter rendering failed." };
  }
  // Trust nothing: confirm the file is actually on disk and non-empty before
  // reporting success, the same honesty gate the CV render applies.
  try {
    if (fs.statSync(coverPaths.finalPdf).size === 0) throw new Error("empty");
  } catch {
    return { kind: "render-failed", error: "Rendering reported success but produced no PDF." };
  }
  return { kind: "ok", pdf: path.basename(coverPaths.finalPdf) };
}
