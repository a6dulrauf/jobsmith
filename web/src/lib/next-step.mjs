// next-step.mjs — decide the ONE thing a user should do next.
//
// Written after watching someone with a CV and a goal get stuck three steps in.
// The portal had fourteen pages and no answer to "what do I do now": scoring a
// job takes Inbox → tick → Save → "Score shortlist", and none of those words is
// "evaluate". The Generate CV button only exists after a job is scored, so it
// cannot be found by looking. And the whole thing silently refuses to run until
// an AI CLI is picked on a settings page nobody is sent to.
//
// So: one ordered list, one visible action, and the reason it matters. The order
// is the real dependency order — each step is genuinely blocked by the one above.
//
// Pure and data-only: the caller supplies state, this returns steps. That keeps
// it testable, and keeps the "am I set up?" question in one place instead of
// spread across components.

/**
 * @param {{
 *   hasCli: boolean, hasCv: boolean, hasProfile: boolean, hasPortals: boolean,
 *   inboxCount: number, reportCount: number, pdfCount: number,
 *   appliedCount: number, outcomeCount: number, topReport: {n: string, company: string, score: string}|null
 * }} s
 */
export function computeSteps(s) {
  const top = s.topReport;
  const steps = [
    {
      id: "cli",
      done: s.hasCli,
      title: "Choose your AI assistant",
      why: "Nothing that thinks — scoring a job, writing a CV — can run until the portal knows which AI tool to use. It is installed already; it just needs picking once.",
      cta: "Open Config",
      href: "/config",
      blocking: true,
    },
    {
      id: "cv",
      done: s.hasCv,
      title: "Add your CV",
      why: "Everything is measured against this. Job scores, tailored CVs, cover letters — all of it reads your CV and nothing else.",
      cta: "Add your CV",
      href: "/cv",
      blocking: true,
    },
    {
      id: "profile",
      done: s.hasProfile,
      title: "Say what you are looking for",
      why: "Target roles, where you can work, whether you need visa sponsorship. Without it, every job looks equally relevant.",
      cta: "Open Config",
      href: "/config",
      blocking: true,
    },
    {
      id: "portals",
      done: s.hasPortals,
      title: "Set up the job scanner",
      why: "Which companies to watch and which job titles count. The defaults are someone else's search, so this is worth ten minutes.",
      cta: "Open Portals",
      href: "/portals",
      blocking: true,
    },
    {
      id: "scan",
      done: s.inboxCount > 0 || s.reportCount > 0,
      title: "Find some jobs",
      why: "Scans 100+ company job boards directly. Free — no AI involved, so run it as often as you like.",
      cta: "Run a scan",
      href: "/explore",
    },
    {
      id: "score",
      done: s.reportCount > 0,
      title: "Score a job against your CV",
      why: "You have jobs but nothing scored yet. Scoring tells you whether a role is worth your evening, and flags ghost jobs before you waste time on them.",
      cta: "Go to the Inbox",
      href: "/pipeline",
      how: [
        "Open the Inbox tab",
        "Tick the jobs that look interesting",
        "Press Save — they drop into the shortlist tray at the bottom",
        'Press "Score shortlist" (this is the step that uses AI, and it shows the cost first)',
      ],
    },
    {
      id: "cv-pdf",
      done: s.pdfCount > 0,
      title: top ? `Make a CV tailored to ${top.company}` : "Make a tailored CV",
      why: "Your CV rewritten for this one job — its keywords, its priorities — with a fact check that refuses to add anything you cannot back up.",
      cta: top ? `Open report #${top.n}` : "Open your pipeline",
      href: top ? `/pipeline/${top.n}` : "/pipeline",
      how: ['Press "Generate CV"', "Then Cover letter and Application email if you want them"],
    },
    {
      id: "apply",
      done: s.appliedCount > 0,
      title: "Send one application",
      why: "The portal never submits anything for you. Read what it produced, then apply on the company's own site.",
      cta: top ? `Open report #${top.n}` : "Open your pipeline",
      href: top ? `/pipeline/${top.n}` : "/pipeline",
      how: ["Open the two documents and read them", "Apply on the company site", 'Come back and set the status to "Applied"'],
    },
    {
      id: "outcome",
      done: s.outcomeCount > 0,
      title: "Record what happened",
      why: "Rejection, interview, silence — logging it is what makes the analytics work. Five applications in, they start telling you which channels actually convert.",
      cta: "Open your pipeline",
      href: "/pipeline",
    },
  ];

  const next = steps.find((x) => !x.done) ?? null;
  return {
    steps,
    next,
    doneCount: steps.filter((x) => x.done).length,
    total: steps.length,
    allDone: next === null,
  };
}
