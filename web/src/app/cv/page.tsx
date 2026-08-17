import { CvEditor } from "@/components/cv-editor";
import { AddToCv } from "@/components/add-to-cv";

export const dynamic = "force-dynamic";

export default function CvPage() {
  return (
    <>
      <CvEditor />
      {/* Adding a project/paper/role belongs with the CV rather than in its own
          nav entry — and it deliberately stops at a preview, because everything
          else in career-ops reads cv.md. */}
      <div className="mx-auto max-w-4xl px-6 pb-12">
        <AddToCv />
      </div>
    </>
  );
}
