"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { GitCompare, Loader2 } from "lucide-react";
import { useJobs } from "@/components/jobs/job-store";
import { CostBadge } from "@/components/cost/cost-badge";

type Row = { n: string; company: string; role: string; score: string; status: string };

// Compares several already-evaluated offers by running the REAL ofertas mode.
// It reads the existing reports rather than re-scoring anything, so the
// comparison can never disagree with the individual evaluations it draws on.
export function CompareOffers({ rows }: { rows: Row[] }) {
  const { jobs, startJob } = useJobs();
  const [picked, setPicked] = useState<string[]>([]);

  const job = useMemo(
    () => jobs.filter((j) => j.kind === "compare").sort((a, b) => b.startedAt - a.startedAt)[0],
    [jobs],
  );
  const running = job?.status === "running";

  const toggle = (n: string) =>
    setPicked((p) => (p.includes(n) ? p.filter((x) => x !== n) : p.length >= 6 ? p : [...p, n]));

  const run = () =>
    startJob({
      title: `Compare ${picked.length} offers`,
      subtitle: picked.map((n) => `#${n}`).join(" · "),
      kind: "compare",
      input: picked.join(","),
      page: "/compare",
    });

  if (rows.length < 2)
    return (
      <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
        Comparing needs at least two evaluated offers. You have {rows.length}.
      </p>
    );

  return (
    <>
      <ul className="divide-y rounded-lg border">
        {rows.map((r) => {
          const on = picked.includes(r.n);
          const full = !on && picked.length >= 6;
          return (
            <li key={r.n} className={`p-3 ${on ? "bg-brand-soft/30" : ""}`}>
              <label className={`flex items-center gap-3 ${full ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}>
                <input
                  type="checkbox"
                  checked={on}
                  disabled={full}
                  onChange={() => toggle(r.n)}
                  className="size-4 accent-brand"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">
                    <span className="font-medium">{r.company}</span>
                    <span className="text-muted-foreground"> · {r.role}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    #{r.n} · {r.score} · {r.status}
                  </span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          onClick={run}
          disabled={picked.length < 2 || running}
          className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-2 text-sm font-medium text-brand-foreground disabled:opacity-50"
        >
          {running ? <Loader2 className="size-4 animate-spin" /> : <GitCompare className="size-4" />}
          {running ? "Comparing…" : `Compare ${picked.length || ""}`.trim()}
          {!running && <CostBadge kind="spend" />}
        </button>
        {picked.length < 2 && <span className="text-sm text-muted-foreground">Pick at least two.</span>}
        {picked.length >= 6 && <span className="text-sm text-muted-foreground">Six is the maximum.</span>}
        {job?.status === "done" && (
          <Link href="/documents" className="text-sm text-brand hover:underline">
            View the comparison →
          </Link>
        )}
        {running && (
          <Link href={`/jobs/${job.id}`} className="text-sm text-brand hover:underline">
            Watch progress →
          </Link>
        )}
      </div>
    </>
  );
}
