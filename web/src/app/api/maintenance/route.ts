import { spawn } from "node:child_process";
import { careerOpsRoot } from "@/lib/career-ops";
import { runMaintenance, MAINTENANCE_OPS } from "@/lib/tracker-ops.mjs";
import { acquireTrackerWrite, releaseTrackerWrite } from "@/lib/core/run-registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 90;

// GET lists the available operations so the UI never hardcodes them.
export function GET() {
  return Response.json({ ops: MAINTENANCE_OPS });
}

// POST runs one allowlisted tracker-maintenance script and relays its output
// verbatim. These scripts have no --json mode, so reshaping their text would
// risk misreporting what they actually said.
//
// The three mutating ops take the tracker write token; verify-pipeline is
// read-only and does not, so a health check can run while something else works.
export async function POST(req: Request) {
  let body: { id?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const op = MAINTENANCE_OPS.find((o: { id: string }) => o.id === body.id);
  if (!op) {
    return Response.json({ ok: false, error: `Unknown maintenance operation: "${body.id}"` }, { status: 400 });
  }

  const token = op.mutates ? acquireTrackerWrite() : null;
  try {
    const result = await runMaintenance({
      spawnFn: spawn,
      execPath: process.execPath,
      root: careerOpsRoot(),
      id: op.id,
    });
    return Response.json(result);
  } finally {
    if (token !== null) releaseTrackerWrite(token);
  }
}
