import { readApplications, findReportFile } from "@/lib/career-ops";
import { InterviewSuite } from "@/components/interview-suite";

export const dynamic = "force-dynamic";

export default async function InterviewPage() {
  // Every tool here builds on an existing evaluation — the prep plan prioritises
  // gaps the report already found, the debrief compares against it. A row with no
  // report has nothing for them to work from.
  const apps = readApplications()
    .filter((a) => findReportFile(a.n) !== null)
    .map((a) => ({ n: a.n, company: a.company, role: a.role, status: a.status }));

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Interview</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Research, plan, practise, debrief. Everything written here lands in{" "}
        <code>interview-prep/</code>, so the CLI reads the same files.
      </p>
      <div className="mt-8">
        <InterviewSuite apps={apps} />
      </div>
    </div>
  );
}
