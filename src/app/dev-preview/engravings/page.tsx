import { notFound } from "next/navigation";
import { Engraving } from "@/components/engraving/Engraving";
import { DRAWING_IDS } from "@/components/engraving/drawings";

export const metadata = { robots: { index: false } };

// Dev-only route: engraving sheet for design review; 404 in production.
export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <div className="container-x grid grid-cols-2 gap-10 pt-32 pb-20 lg:grid-cols-3">
      {DRAWING_IDS.map((id) => (
        <figure key={id} className="border border-line p-4">
          <Engraving id={id} draw className="w-full text-navy" />
          <figcaption className="coord mt-2">{id}</figcaption>
        </figure>
      ))}
    </div>
  );
}
