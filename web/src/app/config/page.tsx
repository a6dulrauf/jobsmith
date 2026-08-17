import { ConfigForm } from "@/components/config-form";
import { TrackerMaintenance } from "@/components/tracker-maintenance";

export default function ConfigPage() {
  return (
    <>
      <ConfigForm />
      {/* Data-integrity operations live with settings rather than in their own
          nav entry: they are occasional housekeeping, not part of the daily loop. */}
      <div className="mx-auto max-w-4xl px-6 pb-12">
        <TrackerMaintenance />
      </div>
    </>
  );
}
