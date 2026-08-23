import { NextRequest } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { careerOpsRoot } from "@/lib/career-ops";
import { findGeneratedDocs } from "@/lib/generated-docs.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Serve the tailored CV PDF the pdf mode wrote to output/cv-…-{company}-…pdf for
// a given offer. Inline so it opens in the browser. Local-first: reads the
// user's own output/ dir.
//
// The kind is decided by findGeneratedDocs() on the FILENAME PREFIX, not by the
// company slug alone. Matching the slug on its own served
// `cover-letter-…-acme-foods-….pdf` whenever the cover letter was the newer
// file, so "View tailored CV" opened the cover letter.
export async function GET(req: NextRequest) {
  const company = (req.nextUrl.searchParams.get("company") ?? "").trim();
  if (!company) return new Response("company required", { status: 400 });

  const root = careerOpsRoot();
  const rel = findGeneratedDocs(root, company).cv;
  const files = rel ? [path.basename(rel)] : [];
  const dir = path.join(root, "output");

  if (!files.length) return new Response("no tailored CV found for this offer", { status: 404 });

  const file = path.join(dir, files[0]);
  try {
    const buf = fs.readFileSync(file);
    return new Response(new Uint8Array(buf), {
      status: 200,
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${files[0]}"`, "Cache-Control": "no-store" },
    });
  } catch {
    return new Response("could not read the PDF", { status: 500 });
  }
}
