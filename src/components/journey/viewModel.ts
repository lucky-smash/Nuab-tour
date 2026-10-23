import { STOPS, stopTours, stopPhoto } from "./config";
import { formatCoord, formatINR } from "@/lib/site";
import type { Tour } from "@/data";
import { destinations } from "@/data/destinations";

export type TourVM = { title: string; href: string; kind: string; duration: string; price: string | null; basis: string | null; booking: string | null };
export type PhotoVM = { src: string; srcSet?: string; alt: string; credit: string; creditUrl: string | null; license: string };
export type StopVM = {
  id: string;
  p: number;
  title: string;
  kicker: string;
  place: string;
  coord: string;
  engraving: string;
  layout: "left" | "right";
  intro: string;
  introSource: string;
  photo: PhotoVM | null;
  tours: TourVM[];
  destinationHref: string;
  destinationLabel: string;
};

export function tourVM(t: Tour): TourVM {
  const sameDay = t.kind === "same-day";
  const kind = sameDay ? (t.mode === "car" ? "Same-day · private car" : "Same-day · seat in coach") : "Multi-day package";
  const duration = sameDay ? (t.durationText === "Full day" ? "Full day" : `Full day · ${t.durationText}`) : t.durationText;
  const basis = sameDay ? t.fareUnit : t.pricing?.basis ?? null;
  return {
    title: t.title,
    href: t.path,
    kind,
    duration,
    price: t.fromPrice != null ? `from ${formatINR(t.fromPrice)}` : null,
    basis: t.fromPrice != null ? basis : null,
    // only genuine booking-engine links for that same tour (see report: one multi-day page links to an unrelated bus booking)
    booking: t.bookingLink && /booking\.nuabtourism\.in/.test(t.bookingLink) ? t.bookingLink : null,
  };
}

export function buildStopVMs(): StopVM[] {
  return STOPS.map((s) => {
    const ph = stopPhoto(s);
    const primary = destinations.find((d) => d.id === s.destinationIds[0])!;
    return {
      id: s.id,
      p: s.p,
      title: s.title,
      kicker: s.kicker,
      place: s.place,
      coord: `${formatCoord(s.lat, "lat")} · ${formatCoord(s.lng, "lng")}`,
      engraving: s.engraving,
      layout: s.layout,
      intro: s.intro,
      introSource: s.introSource,
      photo: ph ? { src: ph.src, srcSet: ph.srcSet, alt: ph.alt, credit: ph.author, creditUrl: ph.sourceUrl, license: ph.license } : null,
      tours: stopTours(s).map(tourVM),
      destinationHref: `/destinations/${primary.id}/`,
      destinationLabel: s.destinationIds.length > 1 && s.id.includes("-") ? s.title : primary.name,
    };
  });
}
