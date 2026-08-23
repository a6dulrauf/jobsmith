"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Circle, Loader2 } from "lucide-react";
import { computeSteps } from "@/lib/next-step.mjs";

// Matches the local const in assistant-console / apply-provider / job-store.
const CONFIG_KEY = "career-ops:config";

export type ServerState = {
  hasCv: boolean;
  hasProfile: boolean;
  hasPortals: boolean;
  inboxCount: number;
  reportCount: number;
  pdfCount: number;
  appliedCount: number;
  outcomeCount: number;
  topReport: { n: string; company: string; score: string } | null;
};

type Step = {
  id: string;
  done: boolean;
  title: string;
  why: string;
  cta: string;
  href: string;
  how?: string[];
  blocking?: boolean;
};

// One question, answered in one place: what do I do next?
//
// This is a client component for a specific reason — whether an AI CLI has been
// chosen lives in localStorage, so the server cannot see it. That is exactly the
// gap that made "Score shortlist" fail with "AI not setup" while the backend
// could see Claude Code installed the whole time.
export function NextStep({ server }: { server: ServerState }) {
  const [hasCli, setHasCli] = useState<boolean | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    const read = () => {
      try {
        const raw = localStorage.getItem(CONFIG_KEY);
        setHasCli(Boolean(raw && JSON.parse(raw).cliId));
      } catch {
        setHasCli(false);
      }
    };
    read();
    window.addEventListener("storage", read);
    return () => window.removeEventListener("storage", read);
  }, []);

  // Render nothing rather than guess while the browser setting is unknown —
  // a flash of "choose your AI assistant" for someone who already has would
  // undermine the one thing this card is for.
  if (hasCli === null)
    return (
      <div className="flex items-center gap-2 rounded-xl border p-6 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Working out where you are…
      </div>
    );

  const { steps, next, doneCount, total, allDone } = computeSteps({ ...server, hasCli }) as {
    steps: Step[];
    next: Step | null;
    doneCount: number;
    total: number;
    allDone: boolean;
  };

  return (
    <section className="rounded-xl border">
      <div className="flex items-center justify-between gap-4 border-b px-6 py-3">
        <p className="text-sm font-medium">{allDone ? "You are set up" : "Your next step"}</p>
        <p className="text-xs tabular-nums text-muted-foreground">
          {doneCount} of {total} done
        </p>
      </div>

      {allDone ? (
        <div className="px-6 py-6">
          <p className="text-sm">
            Everything is running. Keep scanning for new roles, and record what happens to the
            applications you send — that is what makes the numbers on{" "}
            <Link href="/insights" className="text-brand hover:underline">
              Insights
            </Link>{" "}
            mean anything.
          </p>
          <Link
            href="/explore"
            className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-2 text-sm font-medium text-brand-foreground"
          >
            Scan for new jobs <ArrowRight className="size-4" />
          </Link>
        </div>
      ) : (
        <div className="px-6 py-6">
          <h2 className="text-xl font-semibold">{next!.title}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{next!.why}</p>

          {next!.how && (
            <ol className="mt-4 max-w-2xl space-y-1.5 text-sm">
              {next!.how.map((h, i) => (
                <li key={i} className="flex gap-2.5">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium tabular-nums">
                    {i + 1}
                  </span>
                  <span className="text-muted-foreground">{h}</span>
                </li>
              ))}
            </ol>
          )}

          <Link
            href={next!.href}
            className="mt-5 inline-flex items-center gap-1.5 rounded-md bg-brand px-4 py-2 text-sm font-medium text-brand-foreground"
          >
            {next!.cta} <ArrowRight className="size-4" />
          </Link>
        </div>
      )}

      <div className="border-t">
        <button
          onClick={() => setShowAll((v) => !v)}
          className="w-full px-6 py-3 text-left text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          {showAll ? "Hide" : "Show"} the whole journey
        </button>
        {showAll && (
          <ol className="border-t px-6 py-4">
            {steps.map((s) => {
              const isNext = !allDone && s.id === next!.id;
              return (
                <li key={s.id} className="flex items-start gap-3 py-1.5 text-sm">
                  {s.done ? (
                    <Check className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <Circle className={`mt-0.5 size-4 shrink-0 ${isNext ? "text-brand" : "text-muted-foreground/40"}`} />
                  )}
                  <span
                    className={
                      s.done
                        ? "text-muted-foreground line-through decoration-muted-foreground/40"
                        : isNext
                          ? "font-medium"
                          : "text-muted-foreground"
                    }
                  >
                    {s.title}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
}
