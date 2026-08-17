"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CalendarClock, Loader2, MessagesSquare, NotebookPen, Search, Send } from "lucide-react";
import { useJobs } from "@/components/jobs/job-store";
import { CostBadge } from "@/components/cost/cost-badge";

type App = { n: string; company: string; role: string; status: string };

// Matches the local const in assistant-console / apply-provider / company-logo.
// Following that existing pattern rather than introducing a competing shared
// module, which would leave two sources of truth for the same key.
const CONFIG_KEY = "career-ops:config";

/** The CLI chosen in Config, which only the browser knows. */
function useCliId(): string | null {
  const [cliId, setCliId] = useState<string | null>(null);
  useEffect(() => {
    const read = () => {
      try {
        const raw = localStorage.getItem(CONFIG_KEY);
        setCliId(raw ? JSON.parse(raw).cliId || null : null);
      } catch {
        setCliId(null);
      }
    };
    read();
    window.addEventListener("storage", read);
    return () => window.removeEventListener("storage", read);
  }, []);
  return cliId;
}

const ACTIONS = [
  {
    kind: "interview-prep",
    label: "Research the company",
    busy: "Researching…",
    Icon: Search,
    what: "Sourced company intel and a question bank. Every claim is cited — anything unverifiable is left out rather than guessed.",
    needsNotes: false,
  },
  {
    kind: "interview-plan",
    label: "Build a prep plan",
    busy: "Planning…",
    Icon: CalendarClock,
    what: "A time-blocked plan prioritised by the gaps your evaluation already found.",
    needsNotes: false,
  },
  {
    kind: "interview-redflag",
    label: "Check for red flags",
    busy: "Checking…",
    Icon: AlertTriangle,
    what: "Is this company safe to join? Presents sourced signals with their innocent explanations — never accusations.",
    needsNotes: false,
  },
  {
    kind: "interview-debrief",
    label: "Debrief after the interview",
    busy: "Debriefing…",
    Icon: NotebookPen,
    what: "What went well, what did not, which gaps showed up. Grounded only in what you report.",
    needsNotes: true,
  },
] as const;

export function InterviewSuite({ apps }: { apps: App[] }) {
  const { jobs, startJob } = useJobs();
  const cliId = useCliId();
  const [selected, setSelected] = useState(apps[0]?.n ?? "");
  const [notes, setNotes] = useState("");

  const app = apps.find((a) => a.n === selected);

  const jobFor = (kind: string) =>
    jobs.filter((j) => j.kind === kind && j.input === selected).sort((a, b) => b.startedAt - a.startedAt)[0];

  const run = (kind: string, label: string) => {
    if (!app) return;
    startJob({
      title: `${label} · ${app.company}`,
      subtitle: app.role,
      kind,
      input: selected,
      page: "/interview",
      ...(kind === "interview-debrief" ? { notes: notes.trim() } : {}),
    } as Parameters<typeof startJob>[0]);
  };

  if (apps.length === 0)
    return (
      <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
        No evaluated applications yet. The interview tools work from an evaluation, so score a role
        first.
      </p>
    );

  return (
    <>
      <label className="block text-sm font-medium">Which application?</label>
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className="mt-2 w-full rounded-md border px-3 py-2 text-sm"
      >
        {apps.map((a) => (
          <option key={a.n} value={a.n}>
            #{a.n} — {a.company} · {a.role} ({a.status})
          </option>
        ))}
      </select>

      <div className="mt-6 space-y-3">
        {ACTIONS.map((a) => {
          const job = jobFor(a.kind);
          const running = job?.status === "running";
          const blocked = a.needsNotes && notes.trim().length < 20;
          return (
            <div key={a.kind} className="rounded-lg border p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <a.Icon className="size-4" /> {a.label}
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{a.what}</p>
                </div>
                <button
                  onClick={() => run(a.kind, a.label)}
                  disabled={running || blocked || !app}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-surface-hover disabled:opacity-50"
                >
                  {running ? <Loader2 className="size-3.5 animate-spin" /> : null}
                  {running ? a.busy : "Run"}
                  {!running && <CostBadge kind="spend" />}
                </button>
              </div>

              {a.needsNotes && (
                <>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    placeholder="What were you asked? What did you answer? What felt weak? Anything they said about next steps…"
                    className="mt-3 w-full rounded-md border px-3 py-2 text-sm"
                  />
                  {blocked && notes.trim().length > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      A little more detail — the debrief is only as good as what you remember.
                    </p>
                  )}
                </>
              )}

              {job?.status === "running" && (
                <Link href={`/jobs/${job.id}`} className="mt-2 inline-block text-xs text-brand hover:underline">
                  Watch progress →
                </Link>
              )}
              {job?.status === "done" && (
                <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">
                  Written into <code>interview-prep/</code>.
                </p>
              )}
              {job?.status === "error" && (
                <p className="mt-2 text-xs text-red-600 dark:text-red-400">Didn&rsquo;t complete — try again.</p>
              )}
            </div>
          );
        })}
      </div>

      <PracticeChat app={app} cliId={cliId} />
    </>
  );
}

/* ── practice: the one interview mode that is a conversation ───────────────── */

type Msg = { role: "user" | "assistant"; content: string };

// modes/interview/practice.md is a genuine dialogue — the interviewer asks, you
// answer, it probes, and it can step out of character to research a question
// mid-session. That cannot be a button, so it runs through the assistant
// endpoint, which already supports multi-turn history.
//
// That endpoint is deliberately READ-ONLY, so a session writes no transcript.
// That is the honest trade, and the UI says so rather than implying a saved
// record: practice here, then use "Debrief" above to capture what came out of it.
function PracticeChat({ app, cliId }: { app: App | undefined; cliId: string | null }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const context = useMemo(
    () =>
      `The user is running an interview PRACTICE session${app ? ` for application #${app.n} — ${app.company}, ${app.role}` : ""}. ` +
      `Read modes/interview/practice.md and run it EXACTLY: interview them in character, one question at a time, ` +
      `probe their answers, and ground every question in cv.md, config/profile.yml and any interview-prep/ file for this company. ` +
      `Ask ONE question per turn and wait for their answer — never present a list of questions. ` +
      `Do not fabricate facts about the company; if the prep material is thin, say so plainly. ` +
      `You cannot write files in this mode, so do not claim to have saved a transcript.`,
    [app],
  );

  const send = async () => {
    const text = input.trim();
    if (!text || busy || !cliId) return;
    const next = [...msgs, { role: "user" as const, content: text }];
    setMsgs(next);
    setInput("");
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, cliId, history: msgs, pageContext: context }),
      });
      if (!res.ok || !res.body) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let acc = "";
      setMsgs([...next, { role: "assistant", content: "" }]);
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        setMsgs([...next, { role: "assistant", content: acc }]);
        boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight });
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-10">
      <h2 className="flex items-center gap-2 text-lg font-medium">
        <MessagesSquare className="size-4" /> Practice session
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        A real back-and-forth mock interview — one question at a time. This is a conversation, not a
        document, so nothing is saved. Use <strong>Debrief</strong> above afterwards to record what
        came out of it.
      </p>

      {!cliId && (
        <p className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 text-sm">
          No AI CLI configured — set one in Config first.
        </p>
      )}

      {msgs.length > 0 && (
        <div ref={boxRef} className="mt-4 max-h-96 space-y-3 overflow-y-auto rounded-lg border p-4">
          {msgs.map((m, i) => (
            <div key={i} className={m.role === "user" ? "text-right" : ""}>
              <span
                className={`inline-block max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${
                  m.role === "user" ? "bg-brand-soft text-left" : "border"
                }`}
              >
                {m.content || <Loader2 className="size-3.5 animate-spin" />}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 flex items-end gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          rows={2}
          placeholder={msgs.length === 0 ? "Say “start” to begin the mock interview…" : "Your answer…"}
          disabled={!cliId || busy}
          className="min-w-0 flex-1 rounded-md border px-3 py-2 text-sm disabled:opacity-50"
        />
        <button
          onClick={send}
          disabled={!input.trim() || busy || !cliId}
          className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-2 text-sm font-medium text-brand-foreground disabled:opacity-50"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </button>
      </div>
      {err && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{err}</p>}
    </section>
  );
}
