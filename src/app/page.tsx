import { Journey } from "@/components/journey/Journey";
import { buildStopVMs } from "@/components/journey/viewModel";
import { Atlas } from "@/components/map/Atlas";
import { buildAtlasData, journeyLine } from "@/components/map/atlasData";
import { BikeTrips, Company, ContactBand, FeaturedTours, International } from "@/components/home/HomeSections";
import { CoordinateTicker, FeaturedDestinations } from "@/components/home/Destinations";
import { destinations } from "@/data/destinations";
import { formatCoord } from "@/lib/site";

export default function Home() {
  const stops = buildStopVMs();
  return (
    <>
      <Journey stops={stops} destinationCount={destinations.length} heroCoord={`${formatCoord(28.6139, "lat")} · ${formatCoord(77.209, "lng")}`} />
      <CoordinateTicker />
      <FeaturedDestinations />
      <section id="atlas" className="scroll-mt-20 bg-[linear-gradient(180deg,#dee8f4_0%,#eef3f9_55%,#f4f7fa_100%)] py-24 md:py-32" aria-label="Destination atlas">
        <div className="container-x">
          <div className="mb-10 grid gap-6 lg:grid-cols-[1fr_1.2fr] lg:items-end">
            <p className="eyebrow !text-navy">An atlas of NUAB journeys</p>
            <p className="text-lede text-ink/75">Every place NUAB Tourism travels to, at its true coordinates. Search by name, attraction or tour; filter by region, style and theme; select a destination to see its tours, fares and how to book.</p>
          </div>
          <Atlas dests={buildAtlasData()} line={journeyLine()} />
        </div>
      </section>
      <FeaturedTours />
      <International />
      <BikeTrips />
      <Company />
      <ContactBand />
    </>
  );
}
