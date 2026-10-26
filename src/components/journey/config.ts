/**
 * The scroll journey: five featured stops on NUAB's core circuit, in flight order.
 * Everything a stop shows (intro, tours, prices, durations, booking links) is pulled from the
 * extracted business data; this file only chooses *which* records appear and where.
 *
 * The flight is a storytelling device over a stylised atlas — it is NOT a real flight route.
 * Ground routes for road tours are never drawn as if they were real roads.
 */
import { tourBySlug, photo, type Tour } from "@/data";
import { destinationById } from "@/data/destinations";

export type StopLayout = "left" | "right";

export type JourneyStop = {
  id: string;
  /** progress (0..1) at which the aircraft is abeam the landmark */
  p: number;
  title: string;
  kicker: string;
  /** label printed in DM Mono, e.g. 27°10′ N — AGRA / INDIA */
  place: string;
  lat: number;
  lng: number;
  destinationIds: string[];
  engraving: string;
  /**
   * Optional real 3D model standing in for the line engraving (GLB from scripts/convert-landmark.mjs:
   * base on y = 0, height 1). `height` is in scene units; `yaw` (degrees) turns the model from the
   * default "main facade faces the camera" pose; `facade` is the model axis its main face looks along.
   */
  model?: {
    url: string;
    height: number;
    yaw?: number;
    facade?: "+x" | "-x" | "+z" | "-z";
    /** move the monument from the default engraving spot: `ahead` along the heading, `across` = distance from the flight line (default 34) */
    offset?: { ahead?: number; across?: number };
    /** also replace this monument's engraving on the hero skyline (default true) */
    hero?: boolean;
    /** false = hero skyline only: no model at the stop itself (the stop keeps its line engraving) */
    atStop?: boolean;
    credit?: string;
  };
  photoId: string;
  intro: string;
  introSource: string;
  tourSlugs: string[];
  layout: StopLayout;
  /** sky tint near this stop (horizon colour) */
  horizon: string;
};

/** World scale of the atlas: scene units per degree. North is −Z, east is +X. */
export const ATLAS = { K: 60, lng0: 77.4, lat0: 28.0 };
export const toWorld = (lat: number, lng: number): [number, number] => [(lng - ATLAS.lng0) * ATLAS.K, -(lat - ATLAS.lat0) * ATLAS.K];

const intro = (slug: string, i = 0) => {
  const t = tourBySlug(slug);
  if (t && t.kind === "same-day") return t.introParas[i] ?? "";
  if (t && t.kind === "multi-day") return t.introParas[i] ?? "";
  return "";
};

export const STOPS: JourneyStop[] = [
  {
    id: "delhi",
    p: 0.105,
    title: "Delhi",
    kicker: "Departure · the capital",
    place: "DELHI / INDIA",
    lat: 28.6139,
    lng: 77.209,
    destinationIds: ["delhi"],
    engraving: "india-gate",
    model: { url: "/models/landmarks/india-gate.glb", height: 15, yaw: -24, facade: "+x" },
    photoId: "delhi-india-gate",
    intro: intro("delhi-darshan-one-day-tour-by-car", 1),
    introSource: "/delhi-darshan-one-day-tour-by-car/",
    tourSlugs: ["delhi-darshan-one-day-tour-by-car", "delhi-darshan-one-day-tour-by-bus", "6-days-delhi-jaipur-agra-mathura"],
    layout: "left",
    horizon: "#e8eff6",
  },
  {
    id: "agra",
    p: 0.27,
    title: "Agra",
    kicker: "The city of the Taj",
    place: "AGRA / UTTAR PRADESH",
    lat: 27.1751,
    lng: 78.0421,
    destinationIds: ["agra", "fatehpur-sikri"],
    engraving: "taj-mahal",
    model: { url: "/models/landmarks/taj-mahal.glb", height: 12, yaw: -8, facade: "+z", offset: { ahead: 18, across: 40 } },
    photoId: "agra-taj-mahal",
    intro: intro("agra-same-day-tour-by-car"),
    introSource: "/agra-same-day-tour-by-car/",
    tourSlugs: ["agra-same-day-tour-by-car", "agra-same-day-tour-by-bus", "2-night-3-days-agra-mathura"],
    layout: "right",
    horizon: "#f1ece4",
  },
  {
    id: "jaipur",
    p: 0.46,
    title: "Jaipur",
    kicker: "The Pink City",
    place: "JAIPUR / RAJASTHAN",
    lat: 26.9124,
    lng: 75.7873,
    destinationIds: ["jaipur"],
    engraving: "hawa-mahal",
    model: { url: "/models/landmarks/hawa-mahal.glb", height: 13, facade: "+z", offset: { ahead: 16, across: 42 } },
    photoId: "jaipur-hawa-mahal",
    intro: intro("jaipur-same-day-tour-by-car"),
    introSource: "/jaipur-same-day-tour-by-car/",
    tourSlugs: ["jaipur-same-day-tour-by-car", "jaipur-same-day-tour-by-bus", "6-days-delhi-jaipur-agra-mathura"],
    layout: "left",
    horizon: "#f3e7df",
  },
  {
    id: "mathura-vrindavan",
    p: 0.645,
    title: "Mathura – Vrindavan",
    kicker: "The land of Lord Krishna",
    place: "MATHURA · VRINDAVAN / UTTAR PRADESH",
    lat: 27.5287,
    lng: 77.6665,
    destinationIds: ["mathura", "vrindavan", "gokul", "govardhan", "barsana", "nandgaon"],
    engraving: "temple",
    // hero skyline only (at the stop it would stand right beside Delhi's India Gate): the stop keeps its engraving
    model: { url: "/models/landmarks/ram-temple.glb", height: 11, yaw: 30, facade: "-z", atStop: false },
    photoId: "vrindavan-prem-mandir",
    intro: intro("mathura-vrindavan-same-day-tour-by-car"),
    introSource: "/mathura-vrindavan-same-day-tour-by-car/",
    tourSlugs: ["mathura-vrindavan-same-day-tour-by-car", "1-night-2-days-mathura-vrindavan", "2-night-3-days-mathura-pilgrimage", "3-days-mathura-govardhan-agra"],
    layout: "right",
    horizon: "#f2eadb",
  },
  {
    id: "haridwar-rishikesh",
    p: 0.83,
    title: "Haridwar – Rishikesh",
    kicker: "Two holy cities of the Ganga",
    place: "HARIDWAR · RISHIKESH / UTTARAKHAND",
    lat: 30.0163,
    lng: 78.2159,
    destinationIds: ["haridwar", "rishikesh"],
    engraving: "jhula",
    model: { url: "/models/landmarks/laxman-jhula.glb", height: 12, facade: "+z", offset: { ahead: 14, across: 52 } },
    photoId: "rishikesh-laxman-jhula",
    intro: intro("haridwar-and-rishikesh-same-day-tour-by-car"),
    introSource: "/haridwar-and-rishikesh-same-day-tour-by-car/",
    tourSlugs: ["haridwar-and-rishikesh-same-day-tour-by-car", "6-days-mathura-agra-haridwar-tour"],
    layout: "left",
    horizon: "#e4edf5",
  },
];

/** Hero holds until this progress; arrival panel shows from ARRIVAL_P. */
export const HERO_END = 0.045;
export const ARRIVAL_P = 0.94;

export function stopTours(stop: JourneyStop): Tour[] {
  return stop.tourSlugs.map((s) => tourBySlug(s)).filter(Boolean) as Tour[];
}
export const stopPhoto = (stop: JourneyStop) => photo(stop.photoId);
export const stopDestinations = (stop: JourneyStop) => stop.destinationIds.map((id) => destinationById(id)).filter(Boolean);

/**
 * Flight waypoints in world units (x, altitude, z). Stops are passed with the landmark
 * engraving to one side; legs between stops are long, gentle S-curves.
 */
export function flightWaypoints(): [number, number, number][] {
  const W = (lat: number, lng: number, alt: number, dx = 0, dz = 0): [number, number, number] => {
    const [x, z] = toWorld(lat, lng);
    return [x + dx, alt, z + dz];
  };
  return [
    W(28.95, 76.95, 14), // above the morning cloud deck over the NCR
    W(28.62, 77.2, 13, 27, 7), // Delhi abeam
    W(27.95, 77.62, 16.5),
    W(27.18, 78.04, 15.5, -28, 4), // Agra abeam
    W(26.7, 77.5, 17.5),
    W(26.75, 76.6, 17.5),
    W(26.92, 75.79, 15.5, 12.5, -25), // Jaipur abeam
    W(27.35, 76.15, 17.5),
    W(27.5, 76.95, 17.5),
    W(27.53, 77.67, 15.5, -27, 7), // Mathura–Vrindavan abeam
    W(28.3, 78.2, 17.5),
    W(29.15, 78.5, 18),
    W(30.02, 78.22, 16.5, 27, 7), // Haridwar–Rishikesh abeam
    W(30.75, 78.4, 22),
    W(31.45, 78.6, 30), // towards the Garhwal Himalaya
  ];
}
/** index of the waypoint that is abeam each stop (same order as STOPS) */
export const STOP_WAYPOINT_INDEX = [1, 3, 6, 9, 12];
