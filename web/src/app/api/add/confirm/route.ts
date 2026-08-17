import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { careerOpsRoot } from "@/lib/career-ops";
import { resolveAddPaths } from "@/lib/pdf-paths.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// The write half of the "add to CV" gate.
//
// cv.md is the single source of truth every other mode reads — evaluations,
// tailoring, the fact-check gate, the skill-gap classifier. So nothing writes to
// it as a side effect of a run: the agent only prepares a payload, /api/run
// shows a --dry-run preview, and this endpoint performs the insertion after the
// user has seen exactly what would change and said yes.
//
// The token identifies the prepared payload. It is validated (and thereby
// confined to the scratch directory) by resolveAddPaths before it reaches a path.
export async function POST(req: Request) {
  let body: { token?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const resolved = resolveAddPaths(body.token ?? "", careerOpsRoot());
  if (!resolved.ok) return Response.json({ ok: false, error: resolved.error }, { status: 400 });

  const payload = resolved.paths.payload;
  if (!fs.existsSync(payload)) {
    return Response.json(
      { ok: false, error: "That prepared addition is no longer available — re-run the preparation step." },
      { status: 410 },
    );
  }

  const result = await new Promise<{ code: number | null; text: string }>((resolve) => {
    const child = spawn(process.execPath, [path.join(careerOpsRoot(), "add-entry.mjs"), payload], {
      cwd: careerOpsRoot(),
    });
    let buf = "";
    child.stdout.on("data", (d) => { buf += d.toString(); });
    child.stderr.on("data", (d) => { buf += d.toString(); });
    child.on("error", (e) => resolve({ code: null, text: `add-entry.mjs failed to start: ${e.message}` }));
    child.on("close", (code) => resolve({ code, text: buf }));
  });

  if (result.code !== 0) {
    return Response.json({ ok: false, error: result.text.trim().slice(0, 500) }, { status: 500 });
  }

  // Consume the payload so the same approval cannot be replayed into a second
  // insertion. add-entry.mjs is idempotent, but a stale token lingering in the
  // UI shouldn't be re-submittable at all.
  try {
    fs.rmSync(payload, { force: true });
  } catch {
    /* best effort — a leftover payload is harmless, the token is single-use by
       virtue of this deletion attempt plus add-entry's own dedup */
  }

  return Response.json({ ok: true, output: result.text.trim().slice(0, 5000) });
}
