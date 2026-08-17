import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { careerOpsRoot } from "@/lib/career-ops";
import { readProfileNarrative, readModeDoc } from "@/lib/profile-view.mjs";

export const dynamic = "force-dynamic";

type Archetype = {
  name?: string;
  level?: string;
  fit?: string;
  track?: string;
  sell_when?: string;
};
type ProofPoint = { name?: string; hero_metric?: string; url?: string };

const FIT_STYLE: Record<string, string> = {
  primary: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  secondary: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  adjacent: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
};

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-lg font-medium">{title}</h2>
      {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default async function ProfilePage() {
  const root = careerOpsRoot();
  const p = readProfileNarrative(root);
  const profileDoc = readModeDoc(root, "_profile.md");
  const briefDoc = readModeDoc(root, "_brief.md");
  const customDoc = readModeDoc(root, "_custom.md");

  // The file itself flags a stand-in exit story with a PLACEHOLDER comment.
  // Surfacing that is the point of this page — a story you did not write should
  // never be quietly reused in a cover letter.
  const exitStoryIsPlaceholder = p.raw.includes("PLACEHOLDER");

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Profile</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        How career-ops presents you. These files decide which CV framing fires for a given
        job, what your cover letters claim, and how roles get scored. Read-only here —
        edit them in your editor or ask the agent.
      </p>

      {!p.exists && (
        <p className="mt-6 rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 text-sm">
          <code>config/profile.yml</code> does not exist yet. Run onboarding first.
        </p>
      )}
      {p.exists && !p.valid && (
        <p className="mt-6 rounded-lg border border-red-500/40 bg-red-500/5 p-4 text-sm">
          <code>config/profile.yml</code> exists but is not valid YAML, so nothing below could
          be parsed. The raw file is at the bottom of this page.
        </p>
      )}

      {p.valid && (
        <>
          {p.headline && (
            <Section title="Headline">
              <p className="rounded-lg border p-4 text-sm">{p.headline}</p>
            </Section>
          )}

          <Section
            title="Exit story"
            hint="Used in every CV summary, cover letter and interview answer."
          >
            {p.exitStory ? (
              <>
                {exitStoryIsPlaceholder && (
                  <p className="mb-3 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
                    <strong>Marked as a placeholder in the file.</strong> Every fact in it comes
                    from your CV, but the reasoning was not written by you. You will be asked
                    &ldquo;why are you leaving?&rdquo; in the first screen of every process — make sure
                    you can say this out loud.
                  </p>
                )}
                <p className="rounded-lg border p-4 text-sm leading-relaxed">{p.exitStory}</p>
              </>
            ) : (
              <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                Not set. Generated CVs and cover letters will avoid the topic rather than
                invent a reason.
              </p>
            )}
          </Section>

          <Section
            title="Archetypes"
            hint="The evaluator detects which of these a job matches, then applies that framing. This is what replaces keeping separate resume files."
          >
            {p.archetypes.length === 0 ? (
              <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                None configured.
              </p>
            ) : (
              <ul className="divide-y rounded-lg border">
                {(p.archetypes as Archetype[]).map((a, i) => (
                  <li key={`${a.name}-${i}`} className="p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{a.name}</span>
                      {a.fit && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            FIT_STYLE[a.fit] ?? "bg-muted text-muted-foreground"
                          }`}
                        >
                          {a.fit}
                        </span>
                      )}
                      {a.level && (
                        <span className="text-xs text-muted-foreground">{a.level}</span>
                      )}
                    </div>
                    {a.sell_when && (
                      <p className="mt-2 text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">Fires when: </span>
                        {a.sell_when}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {p.superpowers.length > 0 && (
            <Section title="Superpowers">
              <ul className="list-disc space-y-2 rounded-lg border p-4 pl-8 text-sm">
                {p.superpowers.map((s: string, i: number) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </Section>
          )}

          {p.proofPoints.length > 0 && (
            <Section title="Proof points">
              <ul className="divide-y rounded-lg border">
                {(p.proofPoints as ProofPoint[]).map((pt, i) => (
                  <li key={i} className="p-4">
                    <p className="font-medium">{pt.name}</p>
                    {pt.hero_metric && (
                      <p className="mt-1 text-sm text-muted-foreground">{pt.hero_metric}</p>
                    )}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <Section title="Compensation">
            {p.compensationSet ? (
              <p className="rounded-lg border p-4 text-sm">Target range is configured.</p>
            ) : (
              <p className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 text-sm">
                <strong>Not set.</strong> Every evaluation scores compensation as
                &ldquo;unassessed&rdquo; rather than guessing a range from your location or
                seniority. Salary-gap analysis has no baseline until you set one.
              </p>
            )}
          </Section>

          {p.location && (
            <Section title="Location &amp; work authorization">
              <dl className="divide-y rounded-lg border text-sm">
                {Object.entries(p.location).map(([k, v]) => (
                  <div key={k} className="flex gap-4 p-3">
                    <dt className="w-48 shrink-0 text-muted-foreground">{k}</dt>
                    <dd className="min-w-0">{String(v)}</dd>
                  </div>
                ))}
              </dl>
            </Section>
          )}
        </>
      )}

      {profileDoc.exists && (
        <Section
          title="modes/_profile.md"
          hint="Adaptive framing, cross-cutting advantage, location policy. Read by every mode after the shared context."
        >
          <article className="report-prose rounded-lg border p-5">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{profileDoc.content}</ReactMarkdown>
          </article>
        </Section>
      )}

      {briefDoc.exists && (
        <Section
          title="modes/_brief.md"
          hint="The compact brief triage reads instead of the full evaluation stack."
        >
          <article className="report-prose rounded-lg border p-5">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{briefDoc.content}</ReactMarkdown>
          </article>
        </Section>
      )}

      {customDoc.exists && (
        <Section title="modes/_custom.md" hint="Your persistent house rules.">
          <article className="report-prose rounded-lg border p-5">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{customDoc.content}</ReactMarkdown>
          </article>
        </Section>
      )}

      {p.exists && (
        <Section title="Raw config/profile.yml">
          <details className="rounded-lg border">
            <summary className="cursor-pointer p-4 text-sm font-medium">Show raw YAML</summary>
            <pre className="overflow-x-auto border-t p-4 text-xs leading-relaxed">
              {p.raw}
            </pre>
          </details>
        </Section>
      )}
    </div>
  );
}
