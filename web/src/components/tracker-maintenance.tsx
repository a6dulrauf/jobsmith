"use client";

import { useState } from "react";
import { Loader2, ShieldCheck, Wrench } from "lucide-react";
import { MAINTENANCE_OPS } from "@/lib/tracker-ops.mjs";

type Op = { id: string; label: string; what: string; mutates: boolean };

// Runs career-ops' own tracker-integrity scripts. Their output has no --json
// mode, so it is shown verbatim in a <pre> — reshaping it would risk telling you
// something different from what the script said.
//
// Mutating operations require a second click. dedup in particular uses fuzzy
// title matching, so it can merge two genuinely different requisitions at the
// same company; that is a decision worth confirming rather than a button worth
// pressing casually.
export function TrackerMaintenance() {
  const [busy, setBusy] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [output, setOutput] = useState<{ label: string; text: string; exitCode: number | null } | null>(null);

  const run = async (op: Op) => {
    setBusy(op.id);
    setConfirming(null);
    setOutput(null);
    try {
      const res = await fetch("/api/maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: op.id }),
      });
      const j = await res.json();
      setOutput({ label: op.label, text: j.output ?? j.error ?? "(no output)", exitCode: j.exitCode ?? null });
    } catch (e) {
      setOutput({ label: op.label, text: e instanceof Error ? e.message : String(e), exitCode: null });
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="mt-10">
      <h2 className="flex items-center gap-2 text-lg font-medium">
        <Wrench className="size-4" /> Tracker maintenance
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        career-ops&rsquo; own integrity scripts, run against your tracker. Free — no model calls.
      </p>

      <ul className="mt-4 divide-y rounded-lg border">
        {(MAINTENANCE_OPS as Op[]).map((op) => (
          <li key={op.id} className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-medium">
                  {op.label}
                  {op.mutates ? (
                    <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                      writes
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      <ShieldCheck className="size-3" /> read-only
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-sm text-muted-foreground">{op.what}</p>
              </div>

              <div className="shrink-0">
                {confirming === op.id ? (
                  <span className="inline-flex items-center gap-2">
                    <button
                      onClick={() => run(op)}
                      className="rounded-md bg-amber-500 px-3 py-1.5 text-xs font-medium text-white"
                    >
                      Yes, modify the tracker
                    </button>
                    <button
                      onClick={() => setConfirming(null)}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Cancel
                    </button>
                  </span>
                ) : (
                  <button
                    onClick={() => (op.mutates ? setConfirming(op.id) : run(op))}
                    disabled={busy !== null}
                    className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-surface-hover disabled:opacity-50"
                  >
                    {busy === op.id && <Loader2 className="size-3.5 animate-spin" />}
                    {busy === op.id ? "Running…" : "Run"}
                  </button>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>

      {output && (
        <div className="mt-4 rounded-lg border">
          <div className="flex items-center justify-between border-b p-3">
            <p className="text-sm font-medium">{output.label}</p>
            {output.exitCode !== null && (
              <span className="font-mono text-xs text-muted-foreground">exit {output.exitCode}</span>
            )}
          </div>
          <pre className="max-h-96 overflow-auto p-4 text-xs leading-relaxed">{output.text}</pre>
        </div>
      )}
    </section>
  );
}
