import type { Metadata } from "next";
import { Suspense } from "react";
import { Atlas } from "@/components/map/Atlas";
import { buildAtlasData, journeyLine } from "@/components/map/atlasData";
import { PageHeader, Section } from "@/components/page/Blocks";
import { roadTrips } from "@/data";
import { destinations } from "@/data/destinations";

export const metadata: Metadata = {
  title: "Destinations — An Atlas of NUAB Journeys",
  description: "Search every destination NUAB Tourism travels to on an interactive map: same-day tours, Golden Triangle packages, outstation cabs, road-trip guides, Dubai and Thailand.",
  alternates: { canonical: "/destinations/" },
};

export default function DestinationsPage() {
  return (
    <>
      <PageHeader
        crumbs={[{ label: "Destinations" }]}
        eyebrow={`${destinations.length} destinations · true coordinates`}
        title="An atlas of NUAB journeys."
        lede="From the Taj Mahal to the Garhwal Himalaya, Dubai’s skyline to the islands of southern Thailand — every place we travel to, with its tours, fares and how to book."
        engraving="hawa-mahal"
      />
      <section id="atlas" className="scroll-mt-24 bg-white py-10 md:py-14" aria-label="Interactive destination atlas">
        <div className="container-x">
          <Suspense>
            <Atlas dests={buildAtlasData()} line={journeyLine()} title="Search the atlas" />
          </Suspense>
        </div>
      </section>
      <Section id="road-trips" tone="mist" eyebrow="Bike trips · road trips from Delhi / Gurgaon / Noida" title="Road-trip guides">
        <p className="-mt-4 mb-10 max-w-2xl text-ink/75">{roadTrips.intro}. Distances are by road from Delhi, as published in NUAB’s road-trip guides.</p>
        <ol className="grid gap-px bg-line md:grid-cols-2 lg:grid-cols-3">
          {roadTrips.trips.map((t, i) => (
            <li key={t.id} id={`trip-${t.id}`} className="flex flex-col bg-white">
              {t.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={t.image} alt={t.title} loading="lazy" className="aspect-[16/9] w-full object-cover" />
              )}
              <div className="flex flex-1 flex-col p-5">
                <p className="font-mono text-[0.64rem] uppercase tracking-[0.12em] text-stone">{String(i + 1).padStart(2, "0")} · {t.distanceLabel ?? ""}</p>
                <h3 className="mt-1 font-display text-xl text-navy">{t.title}</h3>
                <p className="mt-2 line-clamp-4 text-[0.9rem] text-ink/75">{t.paras[0]}</p>
                {destinations.find((d) => d.roadTrip?.id === t.id) && (
                  <a href={`/destinations/${destinations.find((d) => d.roadTrip?.id === t.id)!.id}/#road-trip`} className="mt-4 self-start text-sm font-semibold text-navy link-underline">Read the guide</a>
                )}
              </div>
            </li>
          ))}
        </ol>
      </Section>
    </>
  );
}
