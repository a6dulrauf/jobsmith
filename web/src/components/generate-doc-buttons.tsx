"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Loader2, Mail, PenLine, RotateCcw, UserSearch } from "lucide-react";
import { useJobs } from "@/components/jobs/job-store";
import { CostBadge } from "@/components/cost/cost-badge";

// Cover letter + application email, alongside GeneratePdfButton. Both fire the
// REAL career-ops modes through worker kinds "cover"/"email" (see
// /api/run) — the web never reimplements a mode, it orchestrates the same one
// the CLI runs, so output is identical either way.
//
// Neither ever sends anything. `email` writes a DRAFT to output/ and stops;
// that human-in-the-loop guarantee is the whole point of career-ops.

type Kind = "cover" | "email" | "contacto";

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
  contacto: {
    label: "Find a contact",
    busy: "Searching…",
    title: "Outreach",
    sub: "hiring manager or recruiter + a short message",
    Icon: UserSearch,
  },
};

function DocButton({ kind, n, company, existing }: { kind: Kind; n: string; company: string; existing?: string | null }) {
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

  // "Already generated" is a fact about the DISK, not about this browser. The
  // job history lives in localStorage, so relying on it alone hid documents
  // that were sitting in output/ — cleared storage, a different browser, or a
  // run that errored after the file had already been written. `existing` is
  // resolved server-side by findGeneratedDocs(); the job is only a faster path
  // to the same answer for a run that just finished in this tab.
  const href = existing ? `/api/documents/${existing}` : "/documents";
  if (job?.status === "done" || existing)
    return (
      <span className="inline-flex items-center gap-1">
        <Link
          href={href}
          target={existing ? "_blank" : undefined}
          rel={existing ? "noreferrer" : undefined}
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

export type ExistingDocs = { cover?: string | null; email?: string | null; contacto?: string | null };

export function GenerateDocButtons({ n, company, existing }: { n: string; company: string; existing?: ExistingDocs }) {
  return (
    <>
      <DocButton kind="cover" n={n} company={company} existing={existing?.cover} />
      <DocButton kind="email" n={n} company={company} existing={existing?.email} />
      <DocButton kind="contacto" n={n} company={company} existing={existing?.contacto} />
    </>
  );
}
