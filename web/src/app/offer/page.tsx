import { OfferPrep } from "@/components/offer-prep";

export const dynamic = "force-dynamic";

export default function OfferPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Offer prep</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Walk through a contract before you sign it: what each clause actually says in plain English,
        what is promised but missing, and the questions worth putting to a lawyer.
      </p>
      <div className="mt-8">
        <OfferPrep />
      </div>
    </div>
  );
}
