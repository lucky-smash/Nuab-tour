import type { GeoJSONSource, Map as MLMap } from "maplibre-gl";
import type { AtlasDest } from "./atlasData";
import { PLANE_PATH } from "@/lib/plane";

/**
 * Illustrative flights on the atlas: from the Delhi hub, small airliners take off in every
 * direction along gentle arcs to each visible destination, trailing a fading contrail, and land;
 * departures are staggered so the sky is never empty. International flights (coral) to the UAE and
 * Thailand always run, whatever the filters, so even the North India view shows them climbing out
 * of Delhi; domestic flights (navy) follow the filters. Arcs are illustrative (like the journey
 * line) — no routes, airlines or schedules are implied. Reduced motion: the arcs only.
 */
export const FLIGHT_HUB = { lng: 77.209, lat: 28.6139 };


type Flight = { id: string; intl: boolean; pts: [number, number][]; dur: number; period: number; phase: number };
const NAVY = "#233a50", CORAL = "#c95f43"; // domestic / international
type FeatureCollection = GeoJSON.FeatureCollection;

const ARC_SAMPLES = 48;
const empty = (): FeatureCollection => ({ type: "FeatureCollection", features: [] });

/** quadratic arc bowed to the north side of the chord, lift growing with distance */
function arc(a: { lng: number; lat: number }, b: { lng: number; lat: number }): [number, number][] {
  const dx = b.lng - a.lng, dy = b.lat - a.lat, len = Math.hypot(dx, dy);
  let px = -dy / len, py = dx / len; // perpendicular
  if (py < 0) { px = -px; py = -py; }
  const lift = Math.min(6, 0.2 * len);
  const cx = (a.lng + b.lng) / 2 + px * lift, cy = (a.lat + b.lat) / 2 + py * lift;
  return Array.from({ length: ARC_SAMPLES + 1 }, (_, i) => {
    const t = i / ARC_SAMPLES, u = 1 - t;
    return [u * u * a.lng + 2 * u * t * cx + t * t * b.lng, u * u * a.lat + 2 * u * t * cy + t * t * b.lat];
  });
}

/** point at parameter t (0..1) along a sampled arc */
function along(pts: [number, number][], t: number): [number, number] {
  const f = Math.min(ARC_SAMPLES - 1e-6, Math.max(0, t * ARC_SAMPLES));
  const i = Math.floor(f), k = f - i;
  return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * k, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k];
}

/** screen heading (degrees clockwise from north) between two lng/lat points, in Web Mercator */
function bearing(p: [number, number], q: [number, number]) {
  const merc = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
  return (Math.atan2(((q[0] - p[0]) * Math.PI) / 180, merc(q[1]) - merc(p[1])) * 180) / Math.PI;
}

/** deterministic PRNG so the departure board is the same on every load */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** top-down airliner with a white keyline, pointing north */
function planeImage(fill: string): ImageData {
  const s = 2, c = document.createElement("canvas");
  c.width = c.height = 64 * s;
  const g = c.getContext("2d")!;
  g.scale(s, s);
  const p = new Path2D(PLANE_PATH);
  g.lineJoin = "round";
  g.lineWidth = 3.2;
  g.strokeStyle = "#ffffff";
  g.stroke(p);
  g.fillStyle = fill;
  g.fill(p);
  return g.getImageData(0, 0, c.width, c.height);
}

export function startFlights(map: MLMap, dests: AtlasDest[], container: HTMLElement) {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hubDest = dests.find((d) => d.id === "delhi");
  const hub = hubDest ? { lng: hubDest.lng, lat: hubDest.lat } : FLIGHT_HUB;
  const r = rng(2024);
  const all: Flight[] = dests
    .filter((d) => Math.hypot(d.lng - hub.lng, d.lat - hub.lat) > 0.35)
    .map((d) => {
      const dist = Math.hypot(d.lng - hub.lng, d.lat - hub.lat);
      const intl = d.country !== "India";
      const dur = Math.min(intl ? 9 : 7.5, Math.max(2.4, 1.8 + dist * 0.22));
      const period = dur + (intl ? 1 : 1.6) + r() * (intl ? 3 : 4.5);
      return { id: d.id, intl, pts: arc(hub, d), dur, period, phase: r() * period };
    });
  const international = all.filter((f) => f.intl);
  let flights = all;

  map.addImage("flight-plane", planeImage(NAVY), { pixelRatio: 2 });
  map.addImage("flight-plane-intl", planeImage(CORAL), { pixelRatio: 2 });
  map.addSource("flight-arcs", { type: "geojson", data: empty() });
  map.addSource("flight-trails", { type: "geojson", data: empty() });
  map.addSource("flight-planes", { type: "geojson", data: empty() });
  // international destinations keep a small coral ring, so their arcs land somewhere even when
  // the filters hide those markers
  map.addSource("flight-ends", {
    type: "geojson",
    data: { type: "FeatureCollection", features: international.map((f) => ({ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: f.pts[ARC_SAMPLES] } })) },
  });
  map.addSource("flight-hub", { type: "geojson", data: { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [hub.lng, hub.lat] } } });
  map.addLayer({ id: "flight-arcs", type: "line", source: "flight-arcs", layout: { "line-cap": "round" }, paint: { "line-color": ["get", "c"], "line-width": 0.9, "line-opacity": ["get", "o"], "line-dasharray": [1, 3] } });
  map.addLayer({ id: "flight-trails", type: "line", source: "flight-trails", layout: { "line-cap": "round" }, paint: { "line-color": ["get", "c"], "line-width": ["interpolate", ["linear"], ["zoom"], 3, 1.2, 8, 2], "line-opacity": ["get", "o"] } });
  map.addLayer({ id: "flight-ends", type: "circle", source: "flight-ends", paint: { "circle-radius": 3.5, "circle-color": "#ffffff", "circle-stroke-color": CORAL, "circle-stroke-width": 1.4 } });
  map.addLayer({ id: "flight-hub", type: "circle", source: "flight-hub", paint: { "circle-radius": 6, "circle-color": "rgba(0,0,0,0)", "circle-stroke-color": NAVY, "circle-stroke-width": 1.2, "circle-stroke-opacity": 0 } });
  map.addLayer({
    id: "flight-planes",
    type: "symbol",
    source: "flight-planes",
    layout: {
      "icon-image": ["get", "img"],
      "icon-size": ["get", "s"],
      "icon-rotate": ["get", "b"],
      "icon-rotation-alignment": "map",
      "icon-allow-overlap": true,
      "icon-ignore-placement": true,
    },
    paint: { "icon-opacity": ["get", "o"] },
  });

  const src = (id: string) => map.getSource(id) as GeoJSONSource | undefined;
  const drawArcs = () =>
    src("flight-arcs")?.setData({ type: "FeatureCollection", features: flights.map((f) => ({ type: "Feature", properties: { c: f.intl ? CORAL : NAVY, o: f.intl ? 0.4 : 0.22 }, geometry: { type: "LineString", coordinates: f.pts } })) });
  drawArcs();

  // ---- animation ---------------------------------------------------------------------------------
  let raf = 0, last = 0, onScreen = true;
  const ease = (t: number) => 0.5 - 0.5 * Math.cos(Math.PI * t);
  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    if (!onScreen || document.hidden || now - last < 33) return; // ~30 fps is plenty for this
    last = now;
    const time = now / 1000;
    const planes: GeoJSON.Feature[] = [], trails: GeoJSON.Feature[] = [];
    for (const f of flights) {
      const local = (time + f.phase) % f.period;
      if (local > f.dur) continue; // on the ground between departures
      const k = local / f.dur, t = ease(k);
      const fade = Math.min(1, k / 0.06, (1 - k) / 0.06);
      const pos = along(f.pts, t), ahead = along(f.pts, Math.min(1, t + 0.01)), behind = along(f.pts, Math.max(0, t - 0.01));
      planes.push({ type: "Feature", properties: { img: f.intl ? "flight-plane-intl" : "flight-plane", b: bearing(behind, ahead), s: (f.intl ? 0.36 : 0.3) + 0.16 * Math.sin(Math.PI * t), o: fade }, geometry: { type: "Point", coordinates: pos } });
      const t0 = Math.max(0, t - (f.intl ? 0.12 : 0.2));
      if (t - t0 > 0.005) {
        const coords = Array.from({ length: 11 }, (_, i) => along(f.pts, t0 + ((t - t0) * i) / 10));
        trails.push({ type: "Feature", properties: { c: f.intl ? CORAL : NAVY, o: (f.intl ? 0.65 : 0.5) * fade }, geometry: { type: "LineString", coordinates: coords } });
      }
    }
    src("flight-planes")?.setData({ type: "FeatureCollection", features: planes });
    src("flight-trails")?.setData({ type: "FeatureCollection", features: trails });
    // the hub breathes: a ring widening and fading out every two seconds
    const h = (time % 2) / 2;
    if (map.getLayer("flight-hub")) {
      map.setPaintProperty("flight-hub", "circle-radius", 6 + 18 * h);
      map.setPaintProperty("flight-hub", "circle-stroke-opacity", 0.55 * (1 - h));
    }
  };
  const io = new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; }, { rootMargin: "100px" });
  io.observe(container);
  if (!reduced) raf = requestAnimationFrame(frame);

  return {
    /** domestic flights only to the destinations the filters show; international ones always */
    setVisible(ids: Set<string>) {
      flights = all.filter((f) => f.intl || ids.has(f.id));
      drawArcs();
    },
    stop() {
      cancelAnimationFrame(raf);
      io.disconnect();
    },
  };
}
