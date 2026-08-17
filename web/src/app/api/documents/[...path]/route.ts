import fs from "node:fs";
import path from "node:path";
import { careerOpsRoot } from "@/lib/career-ops";
import { resolveDocument, contentTypeFor } from "@/lib/documents.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Streams a single generated artifact (tailored CV PDF, cover letter, evaluation
// report) to the browser so the user can read their own output without opening a
// terminal. These are gitignored personal files, so the door is deliberately
// narrow: resolveDocument() enforces a directory allowlist, an extension
// allowlist, no traversal segments, and a realpath containment check that
// defeats symlinks. Anything it refuses is a flat 404 — we never distinguish
// "blocked" from "missing", so the response can't be used to probe the disk.
//
// Security-critical behaviour is covered by tests/lib/documents.test.mjs.
export async function GET(_req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await ctx.params;
  const rel = (segments ?? []).join("/");

  const abs = resolveDocument(careerOpsRoot(), rel);
  if (!abs) return new Response("Not found", { status: 404 });

  let bytes: Buffer;
  try {
    bytes = fs.readFileSync(abs);
  } catch {
    return new Response("Not found", { status: 404 });
  }

  // inline so PDFs open in the browser's viewer rather than downloading.
  // The filename is taken from the resolved path, never from user input.
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": contentTypeFor(abs),
      "Content-Disposition": `inline; filename="${path.basename(abs)}"`,
      "Cache-Control": "no-store",
      // Generated HTML CVs are our own output, but they are still rendered
      // documents — keep them from reaching for the network if edited by hand.
      "Content-Security-Policy": "default-src 'none'; img-src data:; style-src 'unsafe-inline'",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
