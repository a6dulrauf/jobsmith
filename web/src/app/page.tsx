import fs from "node:fs";
import path from "node:path";
import { pipelineSummary, doctorState, careerOpsRoot, findReportFile } from "@/lib/career-ops";
import { OnboardingBanner } from "@/components/onboarding-banner";
import { FirstRunHome } from "@/components/home/first-run-home";
import { TodayDashboard } from "@/components/home/today-dashboard";
import { NextStep, type ServerState } from "@/components/home/next-step";

export const dynamic = "force-dynamic"; // always read fresh local files at request time (never at build — CI has no user data)

/** Everything the "what next" card needs that only the server can see. The one
 *  thing it cannot answer — whether an AI CLI has been chosen — lives in the
 *  browser, so NextStep resolves that itself. */
function serverState(applications: ReturnType<typeof pipelineSummary>["applications"], inboxCount: number): ServerState {
  const root = careerOpsRoot();
  const has = (rel: string) => fs.existsSync(path.join(root, rel));
  const count = (dir: string, ext: string) => {
    try {
      return fs.readdirSync(path.join(root, dir)).filter((f) => f.endsWith(ext)).length;
    } catch {
      return 0;
    }
  };
  const withReport = applications.filter((a) => findReportFile(a.n) !== null);
  // "Applied" here means the application actually left the building — anything
  // past Evaluated. A row still sitting at Evaluated has not been sent.
  const applied = applications.filter((a) => !/^(evaluated|skip)$/i.test(a.status.trim())).length;
  const top = withReport[0] ?? null;

  return {
    hasCv: has("cv.md"),
    hasProfile: has("config/profile.yml"),
    hasPortals: has("portals.yml"),
    inboxCount,
    reportCount: count("reports", ".md"),
    pdfCount: count("output", ".pdf"),
    appliedCount: applied,
    outcomeCount: (() => {
      try {
        return fs.readdirSync(path.join(root, "data", "outcomes")).length;
      } catch {
        return 0;
      }
    })(),
    topReport: top ? { n: top.n, company: top.company, score: top.score } : null,
  };
}

export default function Home() {
  const { phase, onboardingNeeded } = doctorState();
  // First run (truly empty install): the CV-upload takeover IS the home — value
  // before commitment. The full dashboard returns once they have a CV or any data.
  if (phase === "first-run") return <FirstRunHome />;

  const { inbox, applications } = pipelineSummary();
  // The "next step" card sits above everything else, because the dashboard
  // answers "how is it going" and a new user needs "what do I do now" first.
  return (
    <>
      {onboardingNeeded && <OnboardingBanner />}
      <div className="mx-auto max-w-5xl px-6 pt-6">
        <NextStep server={serverState(applications, inbox.length)} />
      </div>
      <TodayDashboard applications={applications} inbox={inbox} inBetween={phase === "in-between"} />
    </>
  );
}
