"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, FilePlus2, Loader2 } from "lucide-react";
import { useJobs } from "@/components/jobs/job-store";
import { CostBadge } from "@/components/cost/cost-badge";

// Adds a finished project, paper or role to cv.md — behind a confirm gate.
//
// cv.md is the file every other mode reads: evaluations score against it, the
// PDF step tailors it, the fact-check gate validates generated documents against
// it. So this never writes as a side effect of a run. The agent prepares a
// payload, the backend shows what add-entry.mjs --dry-run WOULD change, and the
// insertion happens only after an explicit confirmation here.
export function AddToCv() {
  const { jobs, startJob } = useJobs();
  const [desc, setDesc] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const job = useMemo(
    () => jobs.filter((j) => j.kind === "add").sort((a, b) => b.startedAt - a.startedAt)[0],
    [jobs],
  );
  const running = job?.status === "running";

  // The preview + token arrive as a custom stream event from /api/run.
  const [pending, setPending] = useState<{ token: string; preview: string } | null>(null);
  useEffect(() => {
    const onEvent = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (d?.token) setPending({ token: d.token, preview: d.preview ?? "" });
    };
    window.addEventListener("co-add-preview", onEvent);
    return () => window.removeEventListener("co-add-preview", onEvent);
  }, []);

  const prepare = () => {
    setResult(null);
    setPending(null);
    startJob({
      title: "Prepare CV addition",
      subtitle: "preview only — nothing written yet",
      kind: "add",
      input: desc.trim(),
      page: "/cv",
    });
  };

  const confirm = async () => {
    if (!pending) return;
    setConfirming(true);
    try {
      const res = await fetch("/api/add/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: pending.token }),
      });
      const j = await res.json();
      setResult(j.ok ? { ok: true, msg: "Added to cv.md." } : { ok: false, msg: j.error || "Could not apply that." });
      if (j.ok) {
        setPending(null);
        setDesc("");
      }
    } catch (e) {
      setResult({ ok: false, msg: e instanceof Error ? e.message : String(e) });
    } finally {
      setConfirming(false);
    }
  };

  return (
    <section className="mt-10">
      <h2 className="flex items-center gap-2 text-lg font-medium">
        <FilePlus2 className="size-4" /> Add to your CV
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        A finished project, a paper, a new role. Describe it and you will get a preview of exactly
        what would change — nothing is written to <code>cv.md</code> until you confirm.
      </p>

      <textarea
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
        rows={4}
        placeholder="e.g. Shipped an internal Bayt job-board scraper in Node — 70 lines, now used by the whole team. Or paste a URL to a paper or repo."
        className="mt-4 w-full rounded-md border px-3 py-2 text-sm"
      />

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          onClick={prepare}
          disabled={desc.trim().length < 15 || running}
          className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium transition-colors hover:bg-surface-hover disabled:opacity-50"
        >
          {running ? <Loader2 className="size-4 animate-spin" /> : <FilePlus2 className="size-4" />}
          {running ? "Preparing…" : "Prepare preview"}
          {!running && <CostBadge kind="spend" />}
        </button>
        {desc.trim().length > 0 && desc.trim().length < 15 && (
          <span className="text-sm text-muted-foreground">
            Give it a bit more detail — vague input produces vague bullets.
          </span>
        )}
      </div>

      {pending && (
        <div className="mt-5 rounded-lg border border-amber-500/40 bg-amber-500/5">
          <div className="border-b border-amber-500/30 p-3">
            <p className="text-sm font-medium">Preview — nothing written yet</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              This is what <code>add-entry.mjs</code> reported it would do. Read it before confirming.
            </p>
          </div>
          <pre className="max-h-72 overflow-auto p-4 text-xs leading-relaxed">{pending.preview}</pre>
          <div className="flex items-center gap-3 border-t border-amber-500/30 p-3">
            <button
              onClick={confirm}
              disabled={confirming}
              className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-brand-foreground disabled:opacity-50"
            >
              {confirming && <Loader2 className="size-3.5 animate-spin" />}
              {confirming ? "Writing…" : "Confirm — write to cv.md"}
            </button>
            <button onClick={() => setPending(null)} className="text-sm text-muted-foreground hover:text-foreground">
              Discard
            </button>
          </div>
        </div>
      )}

      {result && (
        <p
          className={`mt-3 text-sm ${result.ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
        >
          {result.ok && <CheckCircle2 className="mr-1 inline size-4" />}
          {result.msg}
        </p>
      )}
    </section>
  );
}
