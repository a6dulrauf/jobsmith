"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, Trophy } from "lucide-react";
import { OUTCOME_TYPES } from "@/lib/tracker-ops.mjs";

type Outcome = { id: string; label: string; hint: string };

// Records what actually happened to an application, through the real
// outcome.mjs: it archives the submitted CV/cover letter alongside the posting
// and syncs the tracker status. Recording outcomes is what makes the analytics
// on /insights mean anything later, which is why this sits on the report page
// rather than buried in a menu.
export function RecordOutcome({ n, company }: { n: string; company: string }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const submit = async () => {
    if (!type) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/outcome", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ n, type, note: note.trim() || undefined }),
      });
      const j = await res.json();
      setResult(
        j.ok
          ? { ok: true, msg: `Recorded${j.data?.state ? ` — status is now ${j.data.state}` : ""}.` }
          : { ok: false, msg: j.error || j.data?.reason || "Could not record that outcome." },
      );
      if (j.ok) setOpen(false);
    } catch (e) {
      setResult({ ok: false, msg: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };

  if (!open)
    return (
      <span className="inline-flex items-center gap-2">
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center justify-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors hover:bg-surface-hover max-sm:min-h-[44px]"
        >
          <Trophy className="size-3.5" /> Record outcome
        </button>
        {result && (
          <span className={`text-xs ${result.ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
            {result.ok && <CheckCircle2 className="mr-1 inline size-3.5" />}
            {result.msg}
          </span>
        )}
      </span>
    );

  return (
    <div className="w-full rounded-lg border p-4">
      <p className="text-sm font-medium">What happened with {company}?</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Archives the CV and cover letter you sent alongside the posting, and updates the tracker.
      </p>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {(OUTCOME_TYPES as Outcome[]).map((o) => (
          <label
            key={o.id}
            className={`flex cursor-pointer items-start gap-2 rounded-md border p-2.5 text-sm transition-colors ${
              type === o.id ? "border-brand bg-brand-soft/40" : "hover:bg-surface-hover"
            }`}
          >
            <input
              type="radio"
              name={`outcome-${n}`}
              value={o.id}
              checked={type === o.id}
              onChange={() => setType(o.id)}
              className="mt-0.5 accent-brand"
            />
            <span className="min-w-0">
              <span className="block font-medium">{o.label}</span>
              <span className="block text-xs text-muted-foreground">{o.hint}</span>
            </span>
          </label>
        ))}
      </div>

      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Optional note — what you learned, feedback they gave…"
        className="mt-3 w-full rounded-md border px-3 py-2 text-sm"
      />
      {note.trim().startsWith("-") && (
        <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
          A note cannot start with &ldquo;-&rdquo; — it would be read as a command-line option.
        </p>
      )}

      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={submit}
          disabled={!type || busy || note.trim().startsWith("-")}
          className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-brand-foreground disabled:opacity-50"
        >
          {busy && <Loader2 className="size-3.5 animate-spin" />}
          {busy ? "Recording…" : "Record"}
        </button>
        <button onClick={() => setOpen(false)} className="text-sm text-muted-foreground hover:text-foreground">
          Cancel
        </button>
      </div>

      {result && !result.ok && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{result.msg}</p>
      )}
    </div>
  );
}
