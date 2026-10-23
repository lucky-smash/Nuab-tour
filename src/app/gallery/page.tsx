import type { Metadata } from "next";
import Link from "next/link";
import { gallery } from "@/data";
import { PageHeader, Section } from "@/components/page/Blocks";

export const metadata: Metadata = {
  title: "Gallery — Bike Trips",
  description: "Photographs from NUAB Tourism bike trips and group rides.",
  alternates: { canonical: "/gallery/" },
};

export default function GalleryPage() {
  return (
    <>
      <PageHeader crumbs={[{ label: "Bike trips" }, { label: "Gallery" }]} eyebrow="Bike trips" title="On the road." lede="Group rides and motorcycle journeys from Delhi." engraving="himalaya">
        <div className="flex flex-wrap gap-4 text-sm">
          <Link href="/equipment-safety-gear/" className="font-semibold text-navy link-underline">Equipment & safety gear</Link>
          <Link href="/destinations/#road-trips" className="font-semibold text-navy link-underline">Road-trip guides</Link>
        </div>
      </PageHeader>
      <Section>
        <ul className="columns-1 gap-4 sm:columns-2 lg:columns-3">
          {gallery.images.map((src, i) => (
            <li key={src} className="mb-4 break-inside-avoid">
              <a href={src} target="_blank" rel="noopener noreferrer" className="block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`Bike trip photograph ${i + 1}`} loading="lazy" className="w-full" />
              </a>
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}
