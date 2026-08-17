"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FileLock2, Loader2, Scale, WifiOff } from "lucide-react";
import { useJobs } from "@/components/jobs/job-store";
import { CostBadge } from "@/components/cost/cost-badge";

const MIN_CHARS = 200;

// Contract reading companion. Two properties of this flow are unusual enough to
// state in the UI rather than bury:
//
//   1. It never gives a verdict. "Should I sign?" belongs to the user and their
//      lawyer; this produces the preparation for answering it.
//   2. The run has NO network tools — withheld in the route's tool scope, not
//      merely discouraged in the prompt — because modes/offer-prep.md requires
//      that contract figures never appear in an outbound query.
export function OfferPrep() {
  const { jobs, startJob } = useJobs();
  const [text, setText] = useState("");

  const job = useMemo(
    () => jobs.filter((j) => j.kind === "offer-prep").sort((a, b) => b.startedAt - a.startedAt)[0],
    [jobs],
  );
  const running = job?.status === "running";
  const short = text.trim().length > 0 && text.trim().length < MIN_CHARS;

  const run = () =>
    startJob({
      title: "Offer prep",
      subtitle: "clause walk + lawyer questions",
      kind: "offer-prep",
      input: text,
      page: "/offer",
    });

  return (
    <>
      <div className="rounded-lg border border-sky-500/40 bg-sky-500/5 p-4">
        <p className="flex items-center gap-2 text-sm font-medium">
          <WifiOff className="size-4" /> This runs with no internet access
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Web tools are withheld from this run at the platform level, so contract figures cannot
          leave your machine. The report is written to <code>data/offers/</code>, which is
          gitignored.
        </p>
      </div>

      <div className="mt-4 rounded-lg border p-4">
        <p className="flex items-center gap-2 text-sm font-medium">
          <Scale className="size-4" /> It will not tell you whether to sign
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          No clause gets called &ldquo;risky&rdquo;, &ldquo;fair&rdquo;, or &ldquo;standard&rdquo;. You get what each clause
          says, what is promised but absent, and a list of questions for a lawyer. The decision stays
          yours.
        </p>
      </div>

      <label className="mt-6 block text-sm font-medium">Paste the contract text</label>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={14}
        placeholder="Paste the full offer letter or employment contract here…"
        className="mt-2 w-full rounded-md border px-3 py-2 font-mono text-xs"
      />
      <p className="mt-1 text-xs text-muted-foreground tabular-nums">
        {text.trim().length.toLocaleString()} characters
        {short && ` — need at least ${MIN_CHARS}`}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          onClick={run}
          disabled={text.trim().length < MIN_CHARS || running}
          className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-2 text-sm font-medium text-brand-foreground disabled:opacity-50"
        >
          {running ? <Loader2 className="size-4 animate-spin" /> : <FileLock2 className="size-4" />}
          {running ? "Reading the contract…" : "Walk me through it"}
          {!running && <CostBadge kind="spend" />}
        </button>
        {running && (
          <Link href={`/jobs/${job.id}`} className="text-sm text-brand hover:underline">
            Watch progress →
          </Link>
        )}
        {job?.status === "done" && (
          <span className="text-sm text-emerald-600 dark:text-emerald-400">
            Saved into <code>data/offers/</code>.
          </span>
        )}
        {job?.status === "error" && (
          <span className="text-sm text-red-600 dark:text-red-400">Didn&rsquo;t complete — try again.</span>
        )}
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        A scanned PDF or a DocuSign export often pastes in garbled. The run starts by quoting the
        section headings back to you — if those look wrong, the extraction failed and the analysis
        below them is not trustworthy.
      </p>
    </>
  );
}
