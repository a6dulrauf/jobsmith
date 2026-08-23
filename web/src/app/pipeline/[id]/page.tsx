import { notFound } from "next/navigation";
import { readReport, findApplication, trackerCanDelete, careerOpsRoot } from "@/lib/career-ops";
import { findGeneratedDocs } from "@/lib/generated-docs.mjs";
import { ReportView } from "@/components/report-view";

export const dynamic = "force-dynamic";

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const app = findApplication(id);
  const report = readReport(id);
  if (!app && !report) notFound();
  // Resolved here rather than in the client component: what exists in output/
  // is a fact about the disk, and the server is the only side that can see it.
  const existingDocs = findGeneratedDocs(careerOpsRoot(), app?.company ?? id);
  return (
    <ReportView
      id={id}
      app={app}
      report={report?.content ?? null}
      file={report?.file ?? null}
      canDelete={trackerCanDelete()}
      existingDocs={existingDocs}
    />
  );
}
