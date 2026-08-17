import { spawn } from "node:child_process";
import { careerOpsRoot } from "@/lib/career-ops";
import { runAllInsights } from "@/lib/insights.mjs";

export const dynamic = "force-dynamic";

type Result = {
  id: string;
  title: string;
  what: string;
  state: "ready" | "locked" | "failed";
  data?: Record<string, unknown>;
  message?: string;
  current?: number | null;
  threshold?: number | null;
};

/* ── small presentational pieces ─────────────────────────────────────────── */

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Locked({ r }: { r: Result }) {
  const pct =
    typeof r.current === "number" && typeof r.threshold === "number" && r.threshold > 0
      ? Math.min(100, Math.round((r.current / r.threshold) * 100))
      : 0;
  return (
    <div className="rounded-lg border border-dashed p-5">
      <p className="text-sm font-medium">Not enough data yet</p>
      {typeof r.current === "number" && typeof r.threshold === "number" && (
        <>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-2 text-sm tabular-nums text-muted-foreground">
            {r.current} of {r.threshold}
          </p>
        </>
      )}
      <p className="mt-3 text-sm text-muted-foreground">{r.message}</p>
    </div>
  );
}

function Failed({ r }: { r: Result }) {
  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-5">
      <p className="text-sm font-medium">Could not run</p>
      <p className="mt-1 font-mono text-xs text-muted-foreground">{r.message}</p>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">{children}</p>;
}

/* ── per-script renderers ────────────────────────────────────────────────── */

/* eslint-disable @typescript-eslint/no-explicit-any */

function Stats({ d }: { d: any }) {
  const t = d.tracker ?? {};
  const f = d.funnel ?? {};
  const byStatus: Record<string, number> = t.byStatus ?? {};
  const active = Object.entries(byStatus).filter(([, v]) => Number(v) > 0);
  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Tracked" value={t.total ?? 0} />
        <Stat label="Applied" value={f.everApplied ?? 0} />
        <Stat label="Interviews" value={f.everInterview ?? 0} />
        <Stat label="Avg score" value={t.avgScore ?? "—"} hint={t.topScore ? `top ${t.topScore}` : undefined} />
      </div>
      {active.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {active.map(([k, v]) => (
            <li key={k} className="rounded-full border px-2.5 py-1 text-xs">
              {k} <span className="font-medium tabular-nums">{v}</span>
            </li>
          ))}
        </ul>
      )}
      {f.smallSample && (
        <p className="mt-3 text-xs text-muted-foreground">
          Rates are withheld until the sample is large enough to mean anything — the script
          says so rather than printing a percentage off two applications.
        </p>
      )}
    </>
  );
}

function Reposts({ d }: { d: any }) {
  const clusters: any[] = Array.isArray(d.clusters) ? d.clusters : [];
  const repeat = clusters.filter((c) => (c.repostCount ?? 0) >= 2);
  if (repeat.length === 0) return <Empty>No roles re-listed more than once in the window.</Empty>;
  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Repost clusters" value={repeat.length} />
        <Stat label="Postings scanned" value={d.metadata?.totalRows ?? 0} />
        <Stat label="Window" value={`${d.metadata?.windowDays ?? 90}d`} />
      </div>
      <ul className="mt-3 divide-y rounded-lg border">
        {repeat.slice(0, 10).map((c, i) => (
          <li key={i} className="flex items-center justify-between gap-4 p-3">
            <div className="min-w-0">
              <p className="truncate text-sm">
                <span className="font-medium">{c.company}</span>
                <span className="text-muted-foreground"> · {c.role}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                {c.firstSeen} → {c.lastSeen}
                {c.daysSpan ? ` · ${c.daysSpan}d apart` : ""}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
              ×{c.repostCount}
            </span>
          </li>
        ))}
      </ul>
      {repeat.length > 10 && (
        <p className="mt-2 text-xs text-muted-foreground">Showing 10 of {repeat.length}.</p>
      )}
    </>
  );
}

function Velocity({ d }: { d: any }) {
  const w = d.waiting ?? {};
  const items: any[] = Array.isArray(w.items) ? w.items : [];
  if ((w.inFlight ?? 0) === 0) return <Empty>Nothing in flight — no applications are waiting on a reply.</Empty>;
  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="In flight" value={w.inFlight ?? 0} />
        <Stat label="Typical wait" value={`${w.windowDays?.[0] ?? "?"}–${w.windowDays?.[1] ?? "?"}d`} />
        <Stat label="Unknown dates" value={w.unknownDates ?? 0} />
      </div>
      {items.length > 0 && (
        <ul className="mt-3 divide-y rounded-lg border">
          {items.slice(0, 8).map((it, i) => (
            <li key={i} className="flex items-center justify-between gap-4 p-3 text-sm">
              <span className="truncate">{it.company ?? it.role ?? "—"}</span>
              <span className="shrink-0 tabular-nums text-muted-foreground">{it.daysWaiting ?? it.days ?? "—"}d</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function SalaryGap({ d }: { d: any }) {
  const apps: any[] = Array.isArray(d.applications) ? d.applications : [];
  if (apps.length === 0) {
    return (
      <Empty>
        No salary data yet. This needs a target range in <code>config/profile.yml</code> (currently
        unset, so evaluations score comp as &ldquo;unassessed&rdquo;) plus advertised or actual figures
        from your applications.
      </Empty>
    );
  }
  return (
    <ul className="divide-y rounded-lg border">
      {apps.slice(0, 10).map((a, i) => (
        <li key={i} className="flex items-center justify-between gap-4 p-3 text-sm">
          <span className="truncate">
            {a.company} <span className="text-muted-foreground">· {a.role}</span>
          </span>
          <span className="shrink-0 tabular-nums text-muted-foreground">{a.advertised ?? a.actual ?? "—"}</span>
        </li>
      ))}
    </ul>
  );
}

function ProcessQuality({ d }: { d: any }) {
  const signals: any[] = Array.isArray(d.signals) ? d.signals : [];
  if (signals.length === 0) {
    return (
      <Empty>
        Nothing logged yet. This is built from <code>[process-friction]</code> tags you add to
        interview notes, so it fills in once you are interviewing.
      </Empty>
    );
  }
  return (
    <ul className="divide-y rounded-lg border">
      {signals.slice(0, 10).map((s, i) => (
        <li key={i} className="flex items-center justify-between gap-4 p-3 text-sm">
          <span className="truncate font-medium">{s.company}</span>
          <span className="shrink-0 tabular-nums text-muted-foreground">
            {s.frictionRate ?? s.rate ?? s.count ?? "—"}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Last-resort renderer: a shape this page has no bespoke view for yet. Shows
 *  the real payload rather than pretending there is nothing to see. */
function RawJson({ d }: { d: any }) {
  return (
    <details className="rounded-lg border">
      <summary className="cursor-pointer p-4 text-sm font-medium">Show raw output</summary>
      <pre className="overflow-x-auto border-t p-4 text-xs">{JSON.stringify(d, null, 2)}</pre>
    </details>
  );
}

function Body({ r }: { r: Result }) {
  if (r.state === "locked") return <Locked r={r} />;
  if (r.state === "failed") return <Failed r={r} />;
  const d = r.data as any;
  switch (r.id) {
    case "stats":
      return <Stats d={d} />;
    case "reposts":
      return <Reposts d={d} />;
    case "velocity":
      return <Velocity d={d} />;
    case "salary-gap":
      return <SalaryGap d={d} />;
    case "process-quality":
      return <ProcessQuality d={d} />;
    default:
      return <RawJson d={d} />;
  }
}

/* ── page ────────────────────────────────────────────────────────────────── */

export default async function InsightsPage() {
  const results = (await runAllInsights({
    spawnFn: spawn,
    execPath: process.execPath,
    root: careerOpsRoot(),
  })) as Result[];

  const locked = results.filter((r) => r.state === "locked").length;

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Insights</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        What your own pipeline data says about your search. Every number here comes from a
        career-ops script reading your local files — no model calls, nothing uploaded, free to
        refresh. Reload the page to re-run them.
      </p>

      {locked > 0 && (
        <p className="mt-6 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          <strong className="text-foreground">{locked} of {results.length} need more data.</strong>{" "}
          Those tools refuse to run below a threshold rather than infer a pattern from a couple of
          data points. They unlock as you apply — the counters below show how far off you are.
        </p>
      )}

      <div className="mt-8 space-y-10">
        {results.map((r) => (
          <section key={r.id}>
            <h2 className="text-lg font-medium">{r.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{r.what}</p>
            <div className="mt-4">
              <Body r={r} />
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
