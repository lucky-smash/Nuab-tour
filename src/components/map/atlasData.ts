import { destinations, type Destination } from "@/data/destinations";
import { photo } from "@/data";
import { formatCoord, formatINR } from "@/lib/site";
import { tourVM, type TourVM } from "@/components/journey/viewModel";
import { STOPS } from "@/components/journey/config";

export type AtlasDest = {
  id: string;
  name: string;
  sourceName?: string;
  region: string;
  country: string;
  lat: number;
  lng: number;
  coord: string;
  themes: string[];
  modes: string[];
  summary: string;
  summarySource: string;
  attractions: string[];
  image: { src: string; srcSet?: string; alt: string; credit?: string; creditUrl?: string } | null;
  priceLabel: string | null;
  priceBasis: string | null;
  distanceLabel: string | null;
  tours: TourVM[];
  cabs: { label: string; distance: string | null; time: string | null; fare: string | null; whatsapp: string; page: string }[];
  roadTrip: { title: string; distance: string | null } | null;
  packages: { title: string; href: string; duration: string | null }[];
  href: string;
  featured: boolean;
};

const featuredIds = new Set(STOPS.flatMap((s) => s.destinationIds.slice(0, 2)));

function attractionsFor(d: Destination): string[] {
  const own = d.tours.find((t) => t.kind === "same-day" && t.mode === "car" && t.title.toLowerCase().startsWith(d.name.toLowerCase().split(" ")[0]));
  if (own && own.kind === "same-day") return own.places.map((p) => p.replace(/\s*\(.*?\)\s*/g, " ").replace(/\s+—\s+.*/, "").trim());
  if (d.roadTrip) {
    const hl = d.roadTrip.paras.join(" ").match(/Highlights:\s*([^\n]+?)(?:Dhabas:|$)/);
    if (hl) return hl[1].split(/,\s*/).map((s) => s.trim()).filter(Boolean).slice(0, 6);
  }
  const mdt = d.tours.find((t) => t.kind === "multi-day");
  if (mdt && mdt.kind === "multi-day") {
    const items = mdt.itinerary.flatMap((day) => day.stops.filter((s) => s.title.toLowerCase().includes(d.name.toLowerCase())).flatMap((s) => s.items.map((i) => i.split(":")[0].trim())));
    if (items.length) return [...new Set(items)].slice(0, 6);
  }
  const pk = d.packages[0];
  if (pk) return pk.overview.filter((o) => o.heading).map((o) => o.heading!).slice(0, 5);
  return [];
}

function trim(s: string, n = 300) {
  if (s.length <= n) return s;
  const cut = s.slice(0, n);
  return cut.slice(0, cut.lastIndexOf(" ")) + "…";
}

export function buildAtlasData(): AtlasDest[] {
  return destinations.map((d) => {
    const ph = photo(d.photo);
    const firstPkgImg = d.packages.find((p) => p.image)?.image;
    const image = ph
      ? { src: `/media/commons/${ph.id}-960.webp`, srcSet: ph.srcSet, alt: ph.alt || d.name, credit: `${ph.author} · ${ph.license}`, creditUrl: ph.sourceUrl }
      : d.image
        ? { src: d.image, alt: d.name }
        : d.roadTrip?.image
          ? { src: d.roadTrip.image, alt: d.name }
          : firstPkgImg
            ? { src: firstPkgImg, alt: d.name }
            : null;
    const own = (t: { title: string }) => (t.title.toLowerCase().includes(d.name.toLowerCase().split(/[ &]/)[0]) ? 0 : 1);
    const tours = [...d.tours]
      .sort((a, b) => own(a) - own(b) || (a.kind === b.kind ? 0 : a.kind === "same-day" ? -1 : 1))
      .slice(0, 5)
      .map(tourVM);
    return {
      id: d.id,
      name: d.name,
      sourceName: d.sourceName,
      region: d.region,
      country: d.country,
      lat: d.lat,
      lng: d.lng,
      coord: `${formatCoord(d.lat, "lat")} · ${formatCoord(d.lng, "lng")}`,
      themes: d.themes,
      modes: d.modes,
      summary: trim(d.summary),
      summarySource: d.summarySource,
      attractions: attractionsFor(d),
      image,
      priceLabel: d.fromPrice != null ? `from ${formatINR(d.fromPrice)}` : d.cabs.length ? "₹10/km" : null,
      priceBasis: d.fromPrice != null ? d.fromPriceBasis : d.cabs.length ? "outstation cab" : null,
      distanceLabel: d.distanceFromDelhiKm ? `${d.distanceFromDelhiKm} km from Delhi` : null,
      tours,
      cabs: d.cabs.slice(0, 2).map((c) => ({ label: `${c.from} to ${c.to}`, distance: c.distanceLabel, time: c.travelTime, fare: c.fareLabel, whatsapp: c.whatsapp, page: c.page.path })),
      roadTrip: d.roadTrip ? { title: d.roadTrip.title, distance: d.roadTrip.distanceLabel } : null,
      packages: d.packages.slice(0, 6).map((p) => ({ title: p.title, href: p.path, duration: p.duration })),
      href: `/destinations/${d.id}/`,
      featured: featuredIds.has(d.id),
    };
  });
}

/** Featured journey line, in stop order (illustrative flight line — not a road route). */
export const journeyLine = (): [number, number][] => STOPS.map((s) => [s.lng, s.lat]);
