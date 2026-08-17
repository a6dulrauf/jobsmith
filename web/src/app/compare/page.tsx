import { readApplications, findReportFile } from "@/lib/career-ops";
import { CompareOffers } from "@/components/compare-offers";

export const dynamic = "force-dynamic";

export default async function ComparePage() {
  // Only applications with a real report can be compared — the comparison reads
  // the existing evaluations rather than re-scoring, so a row without one has
  // nothing to contribute.
  const rows = readApplications()
    .filter((a) => findReportFile(a.n) !== null)
    .map((a) => ({ n: a.n, company: a.company, role: a.role, score: a.score, status: a.status }));

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Compare offers</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Pick two or more evaluated offers. The comparison reads their existing reports — scores,
        legitimacy tiers, gaps and risks — so it can never contradict the individual evaluations.
        Compensation stays &ldquo;unassessed&rdquo; wherever the report says so rather than being estimated.
      </p>
      <div className="mt-8">
        <CompareOffers rows={rows} />
      </div>
    </div>
  );
}
