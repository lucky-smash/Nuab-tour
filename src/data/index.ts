/**
 * Typed access to business data extracted from the content archive
 * (scripts/extract-content.mjs -> src/data/generated/*.json). Never hand-edit the generated JSON.
 */
import homeJson from "./generated/home.json";
import aboutJson from "./generated/about.json";
import contactJson from "./generated/contact.json";
import privacyJson from "./generated/privacy.json";
import thankYouJson from "./generated/thank-you.json";
import toursJson from "./generated/tours.json";
import cabsJson from "./generated/cabs.json";
import intlJson from "./generated/international.json";
import galleryJson from "./generated/gallery.json";
import equipmentJson from "./generated/equipment.json";
import roadtripsJson from "./generated/roadtrips.json";
import blogJson from "./generated/blog.json";
import photosJson from "./generated/photos.json";

export const home = homeJson;
export const about = aboutJson;
export const contact = contactJson;
export const privacy = privacyJson;
export const thankYou = thankYouJson;
export const gallery = galleryJson;
export const equipment = equipmentJson;
export const roadTrips = roadtripsJson;
export const blog = blogJson;

export type FAQ = { q: string; a: string };
export type PageMeta = { title: string; url?: string; path?: string; slug?: string; seoTitle?: string; metaDescription?: string; lastModified?: string };

export type CarFare = { vehicle: string; capacity?: string | null; departure?: string; returnTime?: string; fareLabel: string; fare: number | null; unit: string };

export type DayTour = PageMeta & {
  kind: "same-day";
  mode: "car" | "bus";
  slug: string;
  path: string;
  tagline?: string;
  introHeading?: string;
  introParas: string[];
  bookingLink?: string;
  places: string[];
  placesCorrected: boolean;
  notes: string[];
  attractions: { name: string; text: string }[];
  services: string[];
  inclusions: string[];
  exclusions: string[];
  fares: CarFare[];
  fromPrice: number | null;
  fareUnit: string;
  durationText: string;
  startTime: string | null;
  faqs: FAQ[];
};

export type ItineraryDay = { day: number; title: string; paras: string[]; items: string[]; stops: { title: string; items: string[]; text?: string }[] };
export type MultiDayTour = PageMeta & {
  kind: "multi-day";
  slug: string;
  path: string;
  headline?: string;
  introParas: string[];
  bookingLink?: string;
  highlights: string[];
  itinerary: ItineraryDay[];
  pricing: null | { basis: "per person" | "per vehicle"; note: string | null; rows: { label: string; price: number | null; adults?: number | null; vehicle?: string | null; seating?: string }[] };
  fromPrice: number | null;
  temples: string[];
  inclusions: string[];
  exclusions: string[];
  restaurants: string[];
  nights: number;
  days: number;
  durationText: string;
  faqs: FAQ[];
};
export type Tour = DayTour | MultiDayTour;

export type CabRoute = { id: string; from: string; to: string; distanceKm: number | null; distanceLabel: string | null; travelTime: string | null; fareLabel: string | null; service: string | null; paras: string[]; routeVia: string | null; waypoints: string[]; whatsapp: string; whatsappOriginal: string | null };
export type CabPage = PageMeta & { slug: string; path: string; intro?: string; routes: CabRoute[] };

export type IntlPackage = PageMeta & {
  slug: string;
  path: string;
  country: "dubai" | "thailand";
  duration: string | null;
  nights: number | null;
  days: number;
  image: string | null;
  overview: { place: string | null; heading?: string; text: string }[];
  itinerary: { day: number; title: string; text: string }[];
  itineraryNote: string | null;
  inclusions: string[];
  exclusions: string[];
  exclusionsMissing: boolean;
  places: string[];
};
export type IntlLanding = PageMeta & { heroHeading?: string; heroText?: string; heroImage?: string; aboutParas: string[]; cards: { title: string; image: string | null; duration: string | null; slug: string | null }[]; faqs: FAQ[] };

export const carTours = toursJson.car as unknown as DayTour[];
export const busTours = toursJson.bus as unknown as DayTour[];
export const multiDayTours = toursJson.multiDay as unknown as MultiDayTour[];
export const dayTours: DayTour[] = [...carTours, ...busTours];
export const allTours: Tour[] = [...dayTours, ...multiDayTours];
export const cabPages = cabsJson as unknown as CabPage[];
export const cabRoutes: (CabRoute & { page: CabPage })[] = cabPages.flatMap((p) => p.routes.map((r) => ({ ...r, page: p })));
export const intlLandings = intlJson.landings as unknown as Record<"dubai" | "thailand", IntlLanding>;
export const intlPackages = intlJson.packages as unknown as IntlPackage[];

export type Photo = { id: string; src: string; srcSet: string; width: number; height: number; title: string; author: string; license: string; licenseUrl: string | null; sourceUrl: string; alt: string };
export const photos = photosJson as unknown as Record<string, Photo>;
export const photo = (id?: string | null): Photo | undefined => (id ? photos[id] : undefined);

export type BlogPost = { title: string; slug: string; path: string; seoTitle?: string; metaDescription?: string; published?: string; excerpt: string; image: string | null; readingMinutes: number; html: string };
export const blogPosts = blog.posts as unknown as BlogPost[];

export const tourBySlug = (slug: string): Tour | undefined => allTours.find((t) => t.slug === slug);

export const durationShort = (nights: number | null, days: number) => (nights != null ? `${nights}N / ${days}D` : `${days} days`);

/** Short human label for a tour's price, e.g. "from ₹6,500 per vehicle". */
export function tourPriceBasis(t: Tour): string {
  if (t.kind === "same-day") return t.fareUnit;
  return t.pricing?.basis ?? "";
}
