/**
 * Canonical destination list — the single source shared by the scroll journey, the atlas map,
 * search, filters and the destination directory. Stable ids are used in URLs (/destinations/<id>/).
 *
 * Only places that NUAB Tourism actually serves (per the content archive) are listed:
 * same-day / multi-day tour stops, outstation-cab destinations, road-trip guides and the
 * Dubai / Thailand package locations. Descriptions and related offers are derived from the
 * extracted data at build time (see `enrich` below) — nothing is hand-written marketing copy.
 */
import { allTours, cabRoutes, intlPackages, roadTrips, type CabRoute, type CabPage, type IntlPackage, type Tour } from "./index";

export type Region =
  | "Delhi NCR"
  | "Uttar Pradesh"
  | "Rajasthan"
  | "Uttarakhand"
  | "Himachal Pradesh"
  | "Haryana"
  | "Punjab & Chandigarh"
  | "Jammu & Kashmir"
  | "United Arab Emirates"
  | "Thailand";

export type Theme = "heritage" | "spiritual" | "hills" | "nature" | "city" | "beach" | "adventure";
export type Mode = "day-tour" | "multi-day" | "cab" | "road-trip" | "international";

export type DestinationSeed = {
  id: string;
  name: string;
  /** Name exactly as the archive writes it, when it differs */
  sourceName?: string;
  region: Region;
  country: "India" | "UAE" | "Thailand";
  lat: number;
  lng: number;
  themes: Theme[];
  /** extra keywords used to match tours / itineraries */
  match?: string[];
  photo?: string;
  /** company image fallback */
  image?: string;
  attractions?: string[];
};

const S = (d: DestinationSeed) => d;

export const DESTINATION_SEEDS: DestinationSeed[] = [
  // --- Featured journey: Delhi · Agra · Jaipur · Mathura–Vrindavan · Haridwar–Rishikesh
  S({ id: "delhi", name: "Delhi", region: "Delhi NCR", country: "India", lat: 28.6139, lng: 77.209, themes: ["heritage", "city"], match: ["Delhi Darshan", "Red Fort", "India Gate", "Qutub Minar"], photo: "delhi-india-gate" }),
  S({ id: "agra", name: "Agra", region: "Uttar Pradesh", country: "India", lat: 27.1751, lng: 78.0421, themes: ["heritage"], match: ["Taj Mahal", "Agra Fort"], photo: "agra-taj-mahal" }),
  S({ id: "jaipur", name: "Jaipur", region: "Rajasthan", country: "India", lat: 26.9124, lng: 75.7873, themes: ["heritage", "city"], match: ["Hawa Mahal", "Amber Fort", "Pink City"], photo: "jaipur-hawa-mahal" }),
  S({ id: "mathura", name: "Mathura", region: "Uttar Pradesh", country: "India", lat: 27.4924, lng: 77.6737, themes: ["spiritual", "heritage"], match: ["Krishna Janmabhoomi", "Dwarkadhish", "Vishram Ghat"], photo: "mathura-ghat" }),
  S({ id: "vrindavan", name: "Vrindavan", region: "Uttar Pradesh", country: "India", lat: 27.565, lng: 77.6593, themes: ["spiritual"], match: ["Banke Bihari", "Prem Mandir", "Nidhivan"], photo: "vrindavan-prem-mandir" }),
  S({ id: "haridwar", name: "Haridwar", region: "Uttarakhand", country: "India", lat: 29.9457, lng: 78.1642, themes: ["spiritual"], match: ["Har Ki Pauri", "Ganga Aarti", "Mansa Devi"], photo: "haridwar-har-ki-pauri", image: "/media/wp/2026/07/HARIDWAR.jpg" }),
  S({ id: "rishikesh", name: "Rishikesh", region: "Uttarakhand", country: "India", lat: 30.0869, lng: 78.2676, themes: ["spiritual", "adventure", "nature"], match: ["Laxman Jhula", "Lakshman Jhula", "Ram Jhula", "Triveni Ghat"], photo: "rishikesh-laxman-jhula" }),

  // --- Braj circuit & Golden Triangle stops (multi-day packages)
  S({ id: "gokul", name: "Gokul", region: "Uttar Pradesh", country: "India", lat: 27.4396, lng: 77.7205, themes: ["spiritual"], match: ["Nand Bhawan", "Raman Reti", "Brahmand Ghat"] }),
  S({ id: "govardhan", name: "Govardhan", region: "Uttar Pradesh", country: "India", lat: 27.4966, lng: 77.4636, themes: ["spiritual"], match: ["Goverdhan", "Radha Kund", "Kusum Sarovar", "Parikrama"] }),
  S({ id: "barsana", name: "Barsana", region: "Uttar Pradesh", country: "India", lat: 27.649, lng: 77.378, themes: ["spiritual"], match: ["Radha Rani", "Rangili Mahal"], image: "/media/wp/2026/07/BARSANA.jpg" }),
  S({ id: "nandgaon", name: "Nandgaon", region: "Uttar Pradesh", country: "India", lat: 27.714, lng: 77.388, themes: ["spiritual"], match: ["Pavan Sarovar"] }),
  S({ id: "fatehpur-sikri", name: "Fatehpur Sikri", region: "Uttar Pradesh", country: "India", lat: 27.0945, lng: 77.6679, themes: ["heritage"], match: ["Buland Darwaza", "Panch Mahal"] }),

  // --- Road-trip guides (Bike Trips › Destinations)
  S({ id: "garh-mukteshwar", name: "Garh Mukteshwar", region: "Uttar Pradesh", country: "India", lat: 28.7867, lng: 78.1053, themes: ["spiritual", "nature"] }),
  S({ id: "bharatpur", name: "Bharatpur Bird Sanctuary", region: "Rajasthan", country: "India", lat: 27.1592, lng: 77.523, themes: ["nature"] }),
  S({ id: "alwar", name: "Alwar & Sariska", region: "Rajasthan", country: "India", lat: 27.553, lng: 76.6346, themes: ["nature", "heritage"], match: ["Sariska"] }),
  S({ id: "neemrana", name: "Neemrana", region: "Rajasthan", country: "India", lat: 27.9879, lng: 76.387, themes: ["heritage", "adventure"] }),
  S({ id: "dam-dama-lake", name: "Dam Dama Lake", region: "Haryana", country: "India", lat: 28.3074, lng: 77.1298, themes: ["nature"] }),
  S({ id: "sultanpur-bird-sanctuary", name: "Sultanpur Bird Sanctuary", region: "Haryana", country: "India", lat: 28.4644, lng: 76.8913, themes: ["nature"] }),
  S({ id: "surajkund", name: "Surajkund", region: "Haryana", country: "India", lat: 28.4835, lng: 77.2836, themes: ["heritage", "nature"] }),
  S({ id: "manesar", name: "Manesar", region: "Haryana", country: "India", lat: 28.357, lng: 76.9387, themes: ["nature"] }),
  S({ id: "karnal", name: "Karnal", region: "Haryana", country: "India", lat: 29.6857, lng: 76.9905, themes: ["heritage"] }),
  S({ id: "kurukshetra", name: "Kurukshetra", region: "Haryana", country: "India", lat: 29.9695, lng: 76.8783, themes: ["spiritual", "heritage"] }),
  S({ id: "kuchesar", name: "Kuchesar", region: "Uttar Pradesh", country: "India", lat: 28.683, lng: 78.036, themes: ["heritage"] }),
  S({ id: "chandigarh", name: "Chandigarh", region: "Punjab & Chandigarh", country: "India", lat: 30.7333, lng: 76.7794, themes: ["city"] }),

  // --- Outstation cabs: Uttarakhand
  S({ id: "dehradun", name: "Dehradun", region: "Uttarakhand", country: "India", lat: 30.3165, lng: 78.0322, themes: ["hills", "city"] }),
  S({ id: "mussoorie", name: "Mussoorie", region: "Uttarakhand", country: "India", lat: 30.4598, lng: 78.0644, themes: ["hills"], photo: "mussoorie" }),
  S({ id: "dhanaulti", name: "Dhanaulti", region: "Uttarakhand", country: "India", lat: 30.428, lng: 78.242, themes: ["hills", "nature"] }),
  S({ id: "chakrata", name: "Chakrata", region: "Uttarakhand", country: "India", lat: 30.7015, lng: 77.869, themes: ["hills", "nature"] }),
  S({ id: "chopta", name: "Chopta", sourceName: "Chhota", region: "Uttarakhand", country: "India", lat: 30.4867, lng: 79.2117, themes: ["hills", "adventure"], match: ["Chhota"] }),
  S({ id: "nainital", name: "Nainital", region: "Uttarakhand", country: "India", lat: 29.3803, lng: 79.4636, themes: ["hills"], photo: "nainital" }),
  S({ id: "mukteshwar", name: "Mukteshwar", region: "Uttarakhand", country: "India", lat: 29.4722, lng: 79.645, themes: ["hills"] }),
  S({ id: "jim-corbett", name: "Jim Corbett", region: "Uttarakhand", country: "India", lat: 29.549, lng: 78.935, themes: ["nature"] }),
  S({ id: "ramnagar", name: "Ramnagar", region: "Uttarakhand", country: "India", lat: 29.3947, lng: 79.1265, themes: ["nature"] }),
  S({ id: "lansdowne", name: "Lansdowne", region: "Uttarakhand", country: "India", lat: 29.8377, lng: 78.6871, themes: ["hills"] }),
  S({ id: "pauri-garhwal", name: "Pauri Garhwal", region: "Uttarakhand", country: "India", lat: 30.152, lng: 78.78, themes: ["hills"] }),

  // --- Outstation cabs: Himachal Pradesh
  S({ id: "shimla", name: "Shimla", region: "Himachal Pradesh", country: "India", lat: 31.1048, lng: 77.1734, themes: ["hills"], photo: "shimla" }),
  S({ id: "kasauli", name: "Kasauli", region: "Himachal Pradesh", country: "India", lat: 30.8986, lng: 76.9658, themes: ["hills"] }),
  S({ id: "manali", name: "Manali", region: "Himachal Pradesh", country: "India", lat: 32.2432, lng: 77.1892, themes: ["hills", "adventure"], photo: "manali" }),
  S({ id: "kasol", name: "Kasol", region: "Himachal Pradesh", country: "India", lat: 32.0099, lng: 77.315, themes: ["hills", "nature"] }),
  S({ id: "dharamshala", name: "Dharamshala", region: "Himachal Pradesh", country: "India", lat: 32.219, lng: 76.3234, themes: ["hills", "spiritual"], photo: "dharamshala" }),
  S({ id: "mcleodganj", name: "Mcleodganj", region: "Himachal Pradesh", country: "India", lat: 32.2426, lng: 76.3213, themes: ["hills", "spiritual"] }),
  S({ id: "dalhousie", name: "Dalhousie", region: "Himachal Pradesh", country: "India", lat: 32.5387, lng: 75.971, themes: ["hills"] }),
  S({ id: "bir-billing", name: "Bir Billing", region: "Himachal Pradesh", country: "India", lat: 32.0384, lng: 76.7234, themes: ["adventure", "hills"] }),
  S({ id: "palampur", name: "Palampur", region: "Himachal Pradesh", country: "India", lat: 32.1109, lng: 76.5363, themes: ["hills", "nature"] }),
  S({ id: "nahan", name: "Nahan", region: "Himachal Pradesh", country: "India", lat: 30.5596, lng: 77.2961, themes: ["hills"] }),
  S({ id: "paonta-sahib", name: "Paonta Sahib", region: "Himachal Pradesh", country: "India", lat: 30.4384, lng: 77.6241, themes: ["spiritual"] }),

  // --- Outstation cabs: Jammu & Kashmir
  S({ id: "jammu", name: "Jammu", region: "Jammu & Kashmir", country: "India", lat: 32.7266, lng: 74.857, themes: ["city", "spiritual"] }),
  S({ id: "katra", name: "Katra", region: "Jammu & Kashmir", country: "India", lat: 32.9916, lng: 74.9318, themes: ["spiritual"], photo: "katra-vaishno-devi" }),
  S({ id: "vaishno-devi", name: "Vaishno Devi", region: "Jammu & Kashmir", country: "India", lat: 33.0308, lng: 74.949, themes: ["spiritual", "hills"], photo: "katra-vaishno-devi" }),

  // --- International: UAE
  S({ id: "dubai", name: "Dubai", region: "United Arab Emirates", country: "UAE", lat: 25.2048, lng: 55.2708, themes: ["city", "beach", "adventure"], photo: "dubai-skyline" }),
  S({ id: "abu-dhabi", name: "Abu Dhabi", region: "United Arab Emirates", country: "UAE", lat: 24.4539, lng: 54.3773, themes: ["city", "heritage"], match: ["Yas Island", "Yas Islands"], photo: "abu-dhabi-grand-mosque" }),
  S({ id: "sharjah", name: "Sharjah", region: "United Arab Emirates", country: "UAE", lat: 25.3463, lng: 55.4209, themes: ["heritage", "city"] }),
  S({ id: "ras-al-khaimah", name: "Ras Al Khaimah", region: "United Arab Emirates", country: "UAE", lat: 25.8007, lng: 55.9762, themes: ["beach", "adventure"] }),

  // --- International: Thailand
  S({ id: "bangkok", name: "Bangkok", region: "Thailand", country: "Thailand", lat: 13.7563, lng: 100.5018, themes: ["city", "heritage"], photo: "bangkok-wat-arun" }),
  S({ id: "pattaya", name: "Pattaya", region: "Thailand", country: "Thailand", lat: 12.9236, lng: 100.8825, themes: ["beach", "city"] }),
  S({ id: "phuket", name: "Phuket", region: "Thailand", country: "Thailand", lat: 7.8804, lng: 98.3923, themes: ["beach"], photo: "phuket" }),
  S({ id: "krabi", name: "Krabi", region: "Thailand", country: "Thailand", lat: 8.0863, lng: 98.9063, themes: ["beach", "adventure"], photo: "krabi-railay" }),
  S({ id: "koh-samui", name: "Koh Samui", region: "Thailand", country: "Thailand", lat: 9.512, lng: 100.0136, themes: ["beach"], photo: "koh-samui" }),
  S({ id: "koh-phangan", name: "Koh Phangan", region: "Thailand", country: "Thailand", lat: 9.738, lng: 100.015, themes: ["beach"] }),
  S({ id: "hua-hin", name: "Hua Hin", region: "Thailand", country: "Thailand", lat: 12.5684, lng: 99.9577, themes: ["beach"] }),
  S({ id: "chiang-mai", name: "Chiang Mai", region: "Thailand", country: "Thailand", lat: 18.7883, lng: 98.9853, themes: ["heritage", "nature"], match: ["Chinag Mai"], photo: "chiang-mai-doi-suthep" }),
  S({ id: "chiang-rai", name: "Chiang Rai", region: "Thailand", country: "Thailand", lat: 19.9105, lng: 99.8406, themes: ["heritage", "nature"], match: ["Golden Triangle Tour"] }),
];

// ---------------------------------------------------------------------------
// Enrichment from extracted data
// ---------------------------------------------------------------------------
export type RoadTrip = (typeof roadTrips.trips)[number];

export type Destination = DestinationSeed & {
  summary: string;
  summarySource: string;
  tours: Tour[];
  cabs: (CabRoute & { page: CabPage })[];
  roadTrip?: RoadTrip;
  packages: IntlPackage[];
  modes: Mode[];
  fromPrice: number | null;
  fromPriceBasis: string | null;
  distanceFromDelhiKm: number | null;
};

const lc = (s: string) => s.toLowerCase();
const firstSentences = (s: string, n = 2) => {
  const parts = s.replace(/\s+/g, " ").trim().match(/[^.!?]+[.!?]+(\s|$)/g) || [s];
  return parts.slice(0, n).join("").trim();
};

function tourText(t: Tour): string {
  if (t.kind === "same-day") return [t.title, ...t.places, ...t.attractions.map((a) => a.name)].join(" | ");
  return [t.title, t.headline ?? "", ...t.temples, ...t.highlights, ...t.itinerary.flatMap((d) => [d.title, ...d.paras, ...d.items, ...d.stops.flatMap((s) => [s.title, s.text ?? "", ...s.items])])].join(" | ");
}

function matchesTour(seed: DestinationSeed, t: Tour) {
  const hay = lc(tourText(t));
  const keys = [seed.name, ...(seed.match ?? [])].map(lc);
  if (seed.id === "delhi") return /delhi darshan|delhi sightseeing|delhi arrival|6 days delhi/.test(lc(t.title)) || (t.kind === "multi-day" && t.itinerary.some((d) => /delhi sightseeing|delhi arrival/i.test(d.title)));
  return keys.some((k) => hay.includes(k));
}

function enrich(seed: DestinationSeed): Destination {
  const keys = [seed.name, ...(seed.match ?? []), seed.sourceName ?? ""].filter(Boolean).map(lc);
  const tours = seed.country === "India" ? allTours.filter((t) => matchesTour(seed, t)) : [];
  const cabs = cabRoutes.filter((r) => keys.includes(lc(r.to)) && r.from === "Delhi");
  const roadTrip = roadTrips.trips.find((r) => r.id === seed.id || keys.some((k) => lc(r.title).replace(/^delhi to /, "").includes(k)));
  const packages = intlPackages.filter((p) => p.places.some((pl) => keys.includes(lc(pl))) || keys.some((k) => lc(p.title).includes(k)));

  // Summary, in order of specificity
  let summary = "";
  let summarySource = "";
  const dayTour = tours.find((t) => t.kind === "same-day" && t.mode === "car" && keys.some((k) => lc(t.title).startsWith(k)));
  if (dayTour && dayTour.kind === "same-day" && dayTour.introParas[0]) { summary = firstSentences(dayTour.introParas[0], 3); summarySource = dayTour.path; }
  if (!summary && seed.id === "vrindavan") {
    const a = allTours.flatMap((t) => (t.kind === "same-day" ? t.attractions : [])).find((x) => /^vrindavan$/i.test(x.name));
    if (a) { summary = firstSentences(a.text, 3); summarySource = "/agra-same-day-tour-by-car/"; }
  }
  if (!summary && seed.id === "rishikesh") {
    const a = allTours.flatMap((t) => (t.kind === "same-day" ? t.attractions : [])).find((x) => /Laxman Jhula/i.test(x.name));
    if (a) { summary = firstSentences(a.text, 2); summarySource = "/haridwar-and-rishikesh-same-day-tour-by-car/"; }
  }
  if (!summary && roadTrip?.paras[0]) { summary = firstSentences(roadTrip.paras[0], 2); summarySource = "/destinations/#road-trips"; }
  if (!summary && packages.length) {
    for (const p of packages) {
      const o = p.overview.find((x) => x.place && keys.includes(lc(x.place.replace(/\s*–.*$/, "").replace("Chinag", "Chiang"))));
      if (o) { summary = firstSentences(o.text, 2); summarySource = p.path; break; }
    }
  }
  if (!summary) {
    // first itinerary sentence mentioning the place
    for (const t of tours) {
      if (t.kind !== "multi-day") continue;
      const texts = t.itinerary.flatMap((d) => [...d.paras, ...d.stops.map((s) => s.text ?? ""), ...d.stops.flatMap((s) => s.items)]);
      for (const tx of texts) {
        const sentence = (tx.match(/[^.!?]+[.!?]+/g) || []).find((s) => keys.some((k) => lc(s).includes(k)));
        if (sentence && sentence.length > 40) { summary = sentence.trim(); summarySource = t.path; break; }
      }
      if (summary) break;
    }
  }
  if (!summary && cabs[0]) { summary = cabs[0].paras.slice(0, 2).join(" "); summarySource = cabs[0].page.path; }

  const modes = new Set<Mode>();
  if (tours.some((t) => t.kind === "same-day")) modes.add("day-tour");
  if (tours.some((t) => t.kind === "multi-day")) modes.add("multi-day");
  if (cabs.length) modes.add("cab");
  if (roadTrip) modes.add("road-trip");
  if (packages.length) modes.add("international");

  const priced = tours.filter((t) => t.fromPrice != null);
  const cheapest = priced.sort((a, b) => (a.fromPrice ?? 0) - (b.fromPrice ?? 0))[0];
  const distance = cabs[0]?.distanceKm ?? roadTrip?.distanceKm ?? null;
  return {
    ...seed,
    summary,
    summarySource,
    tours,
    cabs,
    roadTrip,
    packages,
    modes: [...modes],
    fromPrice: cheapest?.fromPrice ?? null,
    fromPriceBasis: cheapest ? (cheapest.kind === "same-day" ? cheapest.fareUnit : cheapest.pricing?.basis ?? null) : null,
    distanceFromDelhiKm: distance,
  };
}

export const destinations: Destination[] = DESTINATION_SEEDS.map(enrich);
export const destinationById = (id: string) => destinations.find((d) => d.id === id);

export const REGIONS: Region[] = [...new Set(DESTINATION_SEEDS.map((d) => d.region))];
export const THEMES: { id: Theme; label: string }[] = [
  { id: "heritage", label: "Heritage" },
  { id: "spiritual", label: "Spiritual" },
  { id: "hills", label: "Hills" },
  { id: "nature", label: "Nature & wildlife" },
  { id: "adventure", label: "Adventure" },
  { id: "beach", label: "Beaches" },
  { id: "city", label: "Cities" },
];
export const MODES: { id: Mode; label: string }[] = [
  { id: "day-tour", label: "Same-day tour" },
  { id: "multi-day", label: "Multi-day package" },
  { id: "cab", label: "Outstation cab" },
  { id: "road-trip", label: "Road-trip guide" },
  { id: "international", label: "International package" },
];
