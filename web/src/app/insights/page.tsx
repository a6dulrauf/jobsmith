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

function Patterns({ d }: { d: any }) {
  const f = d.funnel ?? {};
  const v = d.vendorAnalysis ?? {};
  const via = d.viaChannelAnalysis ?? {};
  const th = d.scoreThreshold ?? {};
  const recs: any[] = Array.isArray(d.recommendations) ? d.recommendations : [];
  const vendors: any[] = Array.isArray(v.breakdown) ? v.breakdown : [];
  // The script publishes its own minimum sample for a claim. Respect it: a
  // 100% advance rate off one application is noise, and presenting it as a
  // finding would be worse than showing nothing.
  const vendorClaimable = (v.submitted ?? 0) >= (v.minSampleForClaim ?? 8) && vendors.length > 0;
  const viaClaimable = (via.agencySubmitted ?? 0) + (via.directSubmitted ?? 0) >= (via.minSampleForClaim ?? 8);
  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Applied" value={f.applied ?? 0} />
        <Stat label="Interview" value={f.interview ?? 0} />
        <Stat label="Rejected" value={f.rejected ?? 0} />
        <Stat label="Self-filtered" value={f.skip ?? 0} />
      </div>

      {th.recommended != null && (
        <div className="mt-3 rounded-lg border p-4">
          <p className="text-sm">
            <span className="font-medium">Suggested score floor: {th.recommended}/5</span>
            {th.positiveRange && (
              <span className="text-muted-foreground"> · positives ranged {th.positiveRange}</span>
            )}
          </p>
          {th.reasoning && <p className="mt-1 text-sm text-muted-foreground">{th.reasoning}</p>}
        </div>
      )}

      <h3 className="mt-5 text-sm font-medium">Advance rate by ATS vendor</h3>
      {vendorClaimable ? (
        <ul className="mt-2 divide-y rounded-lg border">
          {vendors.map((b, i) => (
            <li key={i} className="flex items-center justify-between gap-4 p-3 text-sm">
              <span className="capitalize">{b.vendor ?? b.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {b.advanceRate ?? b.rate}% <span className="text-xs">({b.advanced ?? 0}/{b.total ?? 0})</span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>
          Needs {v.minSampleForClaim ?? 8} identified submissions before a per-vendor rate means
          anything — {v.submitted ?? 0} submitted, {v.identified ?? 0} with a known vendor. The
          script withholds the number rather than publish noise.
        </Empty>
      )}

      {viaClaimable && (
        <>
          <h3 className="mt-5 text-sm font-medium">Direct vs agency</h3>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <Stat label="Direct" value={`${via.directAdvanceRate ?? 0}%`} hint={`${via.directSubmitted ?? 0} sent`} />
            <Stat label="Via agency" value={`${via.agencyAdvanceRate ?? 0}%`} hint={`${via.agencySubmitted ?? 0} sent`} />
          </div>
        </>
      )}

      {recs.length > 0 && (
        <>
          <h3 className="mt-5 text-sm font-medium">What the data suggests</h3>
          <ul className="mt-2 space-y-2">
            {recs.slice(0, 5).map((r, i) => (
              <li key={i} className="rounded-lg border p-3">
                <p className="text-sm font-medium">{r.action}</p>
                {r.reasoning && <p className="mt-0.5 text-sm text-muted-foreground">{r.reasoning}</p>}
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

const TIER_STYLE: Record<string, string> = {
  High: "bg-red-500/10 text-red-600 dark:text-red-400",
  Medium: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  Low: "bg-muted text-muted-foreground",
};

function Upskill({ d }: { d: any }) {
  const gaps: any[] = Array.isArray(d.gaps) ? d.gaps : [];
  const m = d.metadata ?? {};
  if (gaps.length === 0) return <Empty>No recurring skill gaps found across your scored reports.</Empty>;
  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Reports analysed" value={m.reportsScored ?? 0} />
        <Stat label="Low-fit reports" value={m.lowFitReports ?? 0} hint={`below ${m.lowFitScoreThreshold ?? 4}/5`} />
        <Stat label="Gaps found" value={gaps.length} />
      </div>
      <ul className="mt-3 divide-y rounded-lg border">
        {gaps.slice(0, 12).map((g, i) => (
          <li key={i} className="flex items-center justify-between gap-4 p-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{g.skill}</p>
              <p className="text-xs text-muted-foreground">
                {g.reports} report{g.reports === 1 ? "" : "s"}
                {g.lowFitReports ? ` · ${g.lowFitReports} below the apply line` : ""}
              </p>
            </div>
            {g.tier && (
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${TIER_STYLE[g.tier] ?? TIER_STYLE.Low}`}
              >
                {g.tier}
              </span>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted-foreground">
        Weighted so gaps from low-scoring roles count more — a 3.1/5 report says more about what
        you are missing than a 4.5/5 one does. Skills already on your CV are excluded
        {typeof m.knownSkillCount === "number" ? ` (${m.knownSkillCount} recognised)` : ""}.
      </p>
    </>
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
    case "patterns":
      return <Patterns d={d} />;
    case "upskill":
      return <Upskill d={d} />;
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
