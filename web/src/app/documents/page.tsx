import Link from "next/link";
import { careerOpsRoot } from "@/lib/career-ops";
import { listDocuments } from "@/lib/documents.mjs";

export const dynamic = "force-dynamic";

type Doc = { rel: string; name: string; kind: string; size: number; modified: string };

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  // Deterministic and locale-independent: this renders on the server, and a
  // locale-formatted date would mismatch the client on hydration.
  return iso.slice(0, 10);
}

const KIND_LABEL: Record<string, string> = {
  pdf: "PDF",
  html: "HTML",
  md: "Report",
};

export default async function DocumentsPage() {
  const docs = listDocuments(careerOpsRoot()) as Doc[];
  const generated = docs.filter((d) => d.rel.startsWith("output/"));
  const reports = docs.filter((d) => d.rel.startsWith("reports/"));

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Documents</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Everything career-ops has generated for you. These files are gitignored personal
        data and live only on this machine — nothing here is uploaded anywhere.
      </p>

      <section className="mt-10">
        <h2 className="text-lg font-medium">
          Generated documents{" "}
          <span className="text-sm font-normal text-muted-foreground">
            ({generated.length})
          </span>
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Tailored CVs and cover letters from <code>output/</code>.
        </p>
        {generated.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
            Nothing generated yet. Run the <code>pdf</code> mode against an evaluated role
            and the PDF will appear here.
          </p>
        ) : (
          <ul className="mt-4 divide-y rounded-lg border">
            {generated.map((d) => (
              <li key={d.rel} className="flex items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <a
                    href={`/api/documents/${d.rel}`}
                    target="_blank"
                    rel="noreferrer"
                    className="block truncate font-medium hover:underline"
                  >
                    {d.name}
                  </a>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {KIND_LABEL[d.kind] ?? d.kind} · {formatSize(d.size)} · {formatDate(d.modified)}
                  </p>
                </div>
                <a
                  href={`/api/documents/${d.rel}`}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
                >
                  Open
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-medium">
          Evaluation reports{" "}
          <span className="text-sm font-normal text-muted-foreground">({reports.length})</span>
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Full A–G evaluations from <code>reports/</code>. The rendered view lives on the
          pipeline page; the raw markdown is linked here.
        </p>
        {reports.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
            No evaluations yet.
          </p>
        ) : (
          <ul className="mt-4 divide-y rounded-lg border">
            {reports.map((d) => {
              const num = d.name.match(/^(\d+)/)?.[1];
              return (
                <li key={d.rel} className="flex items-center justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{d.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatSize(d.size)} · {formatDate(d.modified)}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {num && (
                      <Link
                        href={`/pipeline/${parseInt(num, 10)}`}
                        className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
                      >
                        Rendered
                      </Link>
                    )}
                    <a
                      href={`/api/documents/${d.rel}`}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
                    >
                      Raw
                    </a>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
