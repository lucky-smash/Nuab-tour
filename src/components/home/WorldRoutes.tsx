import { formatCoord } from "@/lib/site";
import region from "@/data/geo/region.json";

/**
 * Engraved navigational chart (equirectangular, 40°E–110°E × 0°–40°N) linking Delhi with the
 * Dubai and Thailand destinations. Positions are true coordinates; the arcs are illustrative
 * (labelled as such) — no flight routes, airlines or schedules are implied.
 */
const W = 700, H = 400;
const LON0 = 40, LON1 = 110, LAT0 = 0, LAT1 = 40;
const px = (lon: number) => ((lon - LON0) / (LON1 - LON0)) * W;
const py = (lat: number) => ((LAT1 - lat) / (LAT1 - LAT0)) * H;
const r = (n: number) => Math.round(n * 10) / 10;

const HUB = { name: "Delhi", lon: 77.209, lat: 28.6139 };
const PLACES = [
  { name: "Dubai", lon: 55.2708, lat: 25.2048, side: "left" },
  { name: "Abu Dhabi", lon: 54.3773, lat: 24.4539, side: "left" },
  { name: "Sharjah", lon: 55.4209, lat: 25.3463, side: "none" },
  { name: "Ras Al Khaimah", lon: 55.9762, lat: 25.8007, side: "up" },
  { name: "Bangkok", lon: 100.5018, lat: 13.7563, side: "right" },
  { name: "Chiang Mai", lon: 98.9853, lat: 18.7883, side: "right" },
  { name: "Pattaya", lon: 100.8825, lat: 12.9236, side: "none" },
  { name: "Phuket", lon: 98.3923, lat: 7.8804, side: "left" },
  { name: "Krabi", lon: 98.9063, lat: 8.0863, side: "right" },
  { name: "Koh Samui", lon: 100.0136, lat: 9.512, side: "right" },
] as const;

/** Country outlines (Natural Earth, India point of view) as SVG path data in chart space. */
function countryPath(rings: number[][][]) {
  return rings.map((ring) => ring.map(([lng, lat], i) => `${i ? "L" : "M"}${r(px(lng))} ${r(py(lat))}`).join("") + "Z").join("");
}
const COUNTRIES = (region.countries as { name: string; rings: number[][][] }[]).map((c) => ({ name: c.name, d: countryPath(c.rings), india: c.name === "India" }));

function arc(a: { lon: number; lat: number }, b: { lon: number; lat: number }, lift: number) {
  const x0 = px(a.lon), y0 = py(a.lat), x1 = px(b.lon), y1 = py(b.lat);
  const mx = (x0 + x1) / 2, my = (y0 + y1) / 2 - lift;
  return `M${r(x0)} ${r(y0)} Q${r(mx)} ${r(my)} ${r(x1)} ${r(y1)}`;
}

export function WorldRoutes() {
  return (
    <figure className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-labelledby="wr-title">
        <title id="wr-title">Chart showing Delhi and NUAB Tourism holiday destinations in the United Arab Emirates and Thailand</title>
        <rect width={W} height={H} fill="#eef3f8" />
        {/* land: India in warm ivory with a navy boundary; neighbours in white with stone borders */}
        <g strokeLinejoin="round">
          {COUNTRIES.filter((c) => !c.india).map((c) => <path key={c.name} d={c.d} fill="#ffffff" stroke="#838177" strokeOpacity=".55" strokeWidth=".6" />)}
          {COUNTRIES.filter((c) => c.india).map((c) => <path key={c.name} d={c.d} fill="#f6efe2" stroke="#233a50" strokeWidth="1.1" />)}
        </g>
        {/* graticule */}
        <g stroke="#838177" strokeOpacity=".22" strokeWidth=".6">
          {Array.from({ length: 8 }, (_, i) => LON0 + i * 10).map((lon) => <line key={lon} x1={r(px(lon))} y1={0} x2={r(px(lon))} y2={H} />)}
          {Array.from({ length: 5 }, (_, i) => LAT0 + i * 10).map((lat) => <line key={lat} x1={0} y1={r(py(lat))} x2={W} y2={r(py(lat))} />)}
        </g>
        <line x1={0} y1={r(py(23.44))} x2={W} y2={r(py(23.44))} stroke="#838177" strokeOpacity=".5" strokeDasharray="1 5" />
        <text x={8} y={r(py(23.44)) - 5} fontFamily="var(--font-dm-mono)" fontSize="9" fill="#838177" letterSpacing="1.2">TROPIC OF CANCER</text>
        <g fontFamily="var(--font-dm-mono)" fontSize="9" fill="#666f79" letterSpacing="1">
          {Array.from({ length: 7 }, (_, i) => LON0 + 10 + i * 10).map((lon) => <text key={lon} x={r(px(lon)) + 3} y={H - 6}>{lon}°E</text>)}
          {Array.from({ length: 3 }, (_, i) => 10 + i * 10).map((lat) => <text key={lat} x={4} y={r(py(lat)) - 4}>{lat}°N</text>)}
        </g>

        {/* illustrative arcs */}
        <g fill="none" stroke="#233a50" strokeWidth="1.1" strokeDasharray="3 4">
          <path d={arc(HUB, PLACES[0], 46)} />
          <path d={arc(HUB, PLACES[4], 70)} />
          <path d={arc(HUB, PLACES[7], 40)} strokeOpacity=".5" />
        </g>
        {/* hub */}
        <g>
          <circle cx={r(px(HUB.lon))} cy={r(py(HUB.lat))} r="9" fill="none" stroke="#233a50" />
          <circle cx={r(px(HUB.lon))} cy={r(py(HUB.lat))} r="3.5" fill="#233a50" />
          <text x={r(px(HUB.lon)) + 14} y={r(py(HUB.lat)) - 8} fontFamily="var(--font-fraunces)" fontSize="20" fill="#233a50">Delhi</text>
          <text x={r(px(HUB.lon)) + 14} y={r(py(HUB.lat)) + 7} fontFamily="var(--font-dm-mono)" fontSize="8.5" fill="#666f79" letterSpacing="1">{formatCoord(HUB.lat, "lat")} {formatCoord(HUB.lon, "lng")}</text>
        </g>
        {PLACES.map((p) => {
          const x = r(px(p.lon)), y = r(py(p.lat));
          const label = p.side !== "none";
          const tx = p.side === "left" ? x - 8 : x + 8;
          const ty = p.side === "up" ? y - 8 : y + 3;
          return (
            <g key={p.name}>
              <circle cx={x} cy={y} r="2.8" fill="#fff" stroke="#233a50" strokeWidth="1.2" />
              {label && (
                <text x={tx} y={ty} textAnchor={p.side === "left" ? "end" : "start"} fontFamily="var(--font-dm-mono)" fontSize="9.5" fill="#20252b" letterSpacing="1">{p.name.toUpperCase()}</text>
              )}
            </g>
          );
        })}
        {/* compass */}
        <g transform={`translate(${W - 46} 48)`} stroke="#233a50" fill="none">
          <circle r="22" strokeOpacity=".6" />
          <circle r="15" strokeOpacity=".3" />
          <path d="M0 -30 L4 0 L0 12 L-4 0 Z" fill="#233a50" stroke="none" />
          <text y="-35" textAnchor="middle" fontFamily="var(--font-fraunces)" fontStyle="italic" fontSize="12" fill="#233a50" stroke="none">N</text>
        </g>
      </svg>
      <figcaption className="mt-2 flex justify-between font-mono text-[0.62rem] uppercase tracking-[0.1em] text-muted">
        <span>Equirectangular · 40°E–110°E · boundaries as per India</span>
        <span>Arcs are illustrative, not flight paths</span>
      </figcaption>
    </figure>
  );
}
