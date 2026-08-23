"use client";

import { useState } from "react";
import { Check, Copy, MessageSquare, Wallet } from "lucide-react";
import { formatMoney } from "@/lib/salary-ask.mjs";

// "What are your salary expectations?" — asked on nearly every screening call
// and in most application forms, and the one question a candidate cannot answer
// without research they have no way to do quickly: it turns on the role, the
// seniority they actually match, the city, the currency, and the company type.
//
// The numbers come from Block D2 of the evaluation, where the research happened
// and the sources were cited. This component only presents them, with the two
// shapes the question is actually asked in — a range for a conversation, one
// figure for a form that rejects a range.

export type SalaryAsk = {
  currency: string;
  period: "year" | "month";
  basis: "gross" | "net";
  rangeLow: number;
  rangeHigh: number;
  singleNumber: number;
  floor: number | null;
  confidence: "High" | "Medium" | "Low";
  anchoredTo: string | null;
  rationale: string | null;
  scriptCall: string | null;
  scriptText: string | null;
  scriptTextSingle: string | null;
};

const CONFIDENCE_TONE: Record<string, string> = {
  High: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  Medium: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  Low: "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-400",
};

function CopyButton({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard?.writeText(value).then(
          () => {
            setDone(true);
            setTimeout(() => setDone(false), 1600);
          },
          () => {
            /* clipboard blocked — the figure is on screen to read */
          },
        );
      }}
      title={`Copy ${label}`}
      className="inline-flex items-center justify-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted transition-colors hover:bg-surface-hover hover:text-foreground max-sm:min-h-[44px]"
    >
      {done ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
      {done ? "Copied" : "Copy"}
    </button>
  );
}

/** A sentence the candidate can use verbatim, with the register it is for.
 *  Shown as text rather than hidden behind a copy button, because people want
 *  to read what they are about to send before they send it. */
function Script({ label, text }: { label: string; text: string }) {
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-faint">{label}</span>
        <span className="ml-auto">
          <CopyButton value={text} label={label.toLowerCase()} />
        </span>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-foreground">{text}</p>
    </div>
  );
}

export function SalaryAskCard({ ask }: { ask: SalaryAsk }) {
  const per = ask.period === "month" ? "per month" : "per year";
  const range = `${formatMoney(ask.rangeLow, ask.currency)} – ${formatMoney(ask.rangeHigh, ask.currency)}`;
  const single = formatMoney(ask.singleNumber, ask.currency);

  return (
    <section className="rounded-lg border border-border bg-surface/40 p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Wallet className="size-4 text-brand" />
        <h2 className="text-sm font-semibold">What to ask for</h2>
        <span
          className={`ml-auto rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
            CONFIDENCE_TONE[ask.confidence] ?? CONFIDENCE_TONE.Low
          }`}
        >
          {ask.confidence} confidence
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-md border border-border bg-background p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-faint">Range to quote</div>
          <div className="mt-1 flex flex-wrap items-baseline gap-2">
            <span className="text-lg font-semibold tabular-nums">{range}</span>
            <span className="text-xs text-muted">
              {ask.basis} {per}
            </span>
          </div>
          <div className="mt-2">
            <CopyButton value={`${range} ${ask.basis} ${per}`} label="the range" />
          </div>
        </div>

        <div className="rounded-md border border-brand/40 bg-brand-soft/40 p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-faint">
            If the form wants one number
          </div>
          <div className="mt-1 flex flex-wrap items-baseline gap-2">
            <span className="text-lg font-semibold tabular-nums text-brand-text">{single}</span>
            <span className="text-xs text-muted">
              {ask.basis} {per}
            </span>
          </div>
          <div className="mt-2">
            <CopyButton value={String(ask.singleNumber)} label="the figure" />
          </div>
        </div>
      </div>

      {(ask.scriptText || ask.scriptTextSingle || ask.scriptCall) && (
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-2 pt-1">
            <MessageSquare className="size-3.5 text-faint" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-faint">
              Ready to say or paste
            </span>
          </div>
          {/* Text field first: it is the most common shape the question takes
              and the one people most often answer badly, because they type a
              bare number into a box that expects a sentence. */}
          {ask.scriptText && <Script label="In a text box on a form" text={ask.scriptText} />}
          {ask.scriptTextSingle && <Script label="If that box wants one figure" text={ask.scriptTextSingle} />}
          {ask.scriptCall && <Script label="Out loud, on a call" text={ask.scriptCall} />}
        </div>
      )}

      <dl className="mt-4 space-y-1.5 text-xs text-muted">
        {ask.anchoredTo && (
          <div className="flex gap-2">
            <dt className="shrink-0 font-medium text-foreground">Anchored to</dt>
            {/* Stated explicitly because it is the thing most likely to be got
                wrong: the figure is this ROLE's market, never where you live. */}
            <dd>{ask.anchoredTo}</dd>
          </div>
        )}
        {ask.rationale && (
          <div className="flex gap-2">
            <dt className="shrink-0 font-medium text-foreground">Basis</dt>
            <dd>{ask.rationale}</dd>
          </div>
        )}
        {ask.floor !== null && (
          <div className="flex gap-2">
            <dt className="shrink-0 font-medium text-foreground">Walk away below</dt>
            <dd className="tabular-nums">{formatMoney(ask.floor, ask.currency)}</dd>
          </div>
        )}
      </dl>

      <p className="mt-3 border-t border-border pt-3 text-xs text-faint">
        A researched estimate, not an offer. Give the range in conversation and the single figure only when a form
        refuses one — an opening number is negotiated down, never up.
      </p>
    </section>
  );
}
