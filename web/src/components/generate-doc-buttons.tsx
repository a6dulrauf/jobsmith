"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Loader2, Mail, PenLine, RotateCcw } from "lucide-react";
import { useJobs } from "@/components/jobs/job-store";
import { CostBadge } from "@/components/cost/cost-badge";

// Cover letter + application email, alongside GeneratePdfButton. Both fire the
// REAL career-ops modes through worker kinds "cover"/"email" (see
// /api/run) — the web never reimplements a mode, it orchestrates the same one
// the CLI runs, so output is identical either way.
//
// Neither ever sends anything. `email` writes a DRAFT to output/ and stops;
// that human-in-the-loop guarantee is the whole point of career-ops.

type Kind = "cover" | "email";

const SPEC: Record<Kind, { label: string; busy: string; title: string; sub: string; Icon: typeof Mail }> = {
  cover: {
    label: "Cover letter",
    busy: "Writing…",
    title: "Cover letter",
    sub: "researched, grounded in your CV",
    Icon: PenLine,
  },
  email: {
    label: "Application email",
    busy: "Drafting…",
    title: "Application email",
    sub: "draft only — never sent",
    Icon: Mail,
  },
};

function DocButton({ kind, n, company }: { kind: Kind; n: string; company: string }) {
  const { jobs, startJob } = useJobs();
  const spec = SPEC[kind];
  const job = useMemo(
    () => jobs.filter((j) => j.kind === kind && j.input === n).sort((a, b) => b.startedAt - a.startedAt)[0],
    [jobs, kind, n],
  );

  const run = () =>
    startJob({ title: `${spec.title} · ${company}`, subtitle: spec.sub, kind, input: n, page: `/pipeline/${n}` });

  if (job?.status === "running")
    return (
      <Link
        href={`/jobs/${job.id}`}
        className="inline-flex items-center justify-center gap-1.5 rounded-full border border-brand/40 bg-brand-soft px-3 py-1 text-xs font-medium text-brand max-sm:min-h-[44px]"
      >
        <Loader2 className="size-3.5 animate-spin" /> {spec.busy}
      </Link>
    );

  // Done: point at Documents rather than guessing the filename here. The
  // backend owns naming, so the index is the honest place to find the artifact.
  if (job?.status === "done")
    return (
      <span className="inline-flex items-center gap-1">
        <Link
          href="/documents"
          className="inline-flex items-center justify-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-500/15 dark:text-emerald-400 max-sm:min-h-[44px]"
        >
          <spec.Icon className="size-3.5" /> View {spec.label.toLowerCase()}
        </Link>
        <button
          onClick={run}
          title={`Regenerate the ${spec.label.toLowerCase()}`}
          className="inline-flex items-center justify-center rounded-full p-1 text-faint transition-colors hover:text-brand max-sm:min-h-[44px] max-sm:min-w-[44px]"
        >
          <RotateCcw className="size-3.5" />
        </button>
      </span>
    );

  return (
    <button
      onClick={run}
      className="inline-flex items-center justify-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors hover:bg-surface-hover max-sm:min-h-[44px]"
    >
      <spec.Icon className="size-3.5" /> {spec.label}
      {/* Both call the model, so both are "spend" — shown before the click,
          never after, matching the inbox's never-spend-by-surprise rule. */}
      <CostBadge kind="spend" />
    </button>
  );
}

export function GenerateDocButtons({ n, company }: { n: string; company: string }) {
  return (
    <>
      <DocButton kind="cover" n={n} company={company} />
      <DocButton kind="email" n={n} company={company} />
    </>
  );
}
