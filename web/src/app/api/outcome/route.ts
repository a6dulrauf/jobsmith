import { spawn } from "node:child_process";
import { careerOpsRoot } from "@/lib/career-ops";
import { runOutcome } from "@/lib/tracker-ops.mjs";
import { acquireTrackerWrite, releaseTrackerWrite } from "@/lib/core/run-registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Records an application outcome through the REAL outcome.mjs — the same script
// the CLI runs — which archives the submitted artifacts and syncs the tracker.
// No outcome logic lives here.
//
// Holds the tracker write token for the duration, because this mutates
// data/applications.md and must not interleave with a row delete or an
// evaluation's merge.
export async function POST(req: Request) {
  let body: { n?: string; type?: string; stage?: string; feedback?: string; note?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const token = acquireTrackerWrite();
  try {
    const result = await runOutcome({
      spawnFn: spawn,
      execPath: process.execPath,
      root: careerOpsRoot(),
      n: body.n ?? "",
      type: body.type ?? "",
      stage: body.stage,
      feedback: body.feedback,
      note: body.note,
    });
    // Validation failures are the caller's fault (400); a script failure is not.
    // runOutcome flags the former explicitly — matching on error prose is fragile
    // and previously reported a rejected note as a 500.
    const status = result.ok ? 200 : result.invalid ? 400 : 500;
    return Response.json(result, { status });
  } finally {
    releaseTrackerWrite(token);
  }
}
