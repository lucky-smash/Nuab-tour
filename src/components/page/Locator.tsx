import type { Destination } from "@/data/destinations";
import { formatCoord } from "@/lib/site";
import india from "@/data/geo/india.json";
import region from "@/data/geo/region.json";

/** Small engraved locator chart: graticule + the destination and its neighbours at true positions. */
export function Locator({ d, neighbours }: { d: Destination; neighbours: Destination[] }) {
  const span = d.country === "India" ? 3.2 : 4;
  const lon0 = d.lng - span, lon1 = d.lng + span, lat0 = d.lat - span * 0.62, lat1 = d.lat + span * 0.62;
  const W = 400, H = 250;
  const x = (lon: number) => ((lon - lon0) / (lon1 - lon0)) * W;
  const y = (lat: number) => ((lat1 - lat) / (lat1 - lat0)) * H;
  const r = (n: number) => Math.round(n * 10) / 10;
  const path = (rings: number[][][]) => rings.map((ring) => ring.map(([lng, lat], i) => `${i ? "L" : "M"}${r(x(lng))} ${r(y(lat))}`).join("") + "Z").join("");
  const near = (rings: number[][][]) => rings.some((ring) => ring.some(([lng, lat]) => lng > lon0 - 6 && lng < lon1 + 6 && lat > lat0 - 6 && lat < lat1 + 6));
  const others = (region.countries as { name: string; rings: number[][][] }[]).filter((c) => c.name !== "India" && near(c.rings));
  const grid: number[] = [];
  for (let g = Math.ceil(lon0); g <= lon1; g++) grid.push(g);
  const gridLat: number[] = [];
  for (let g = Math.ceil(lat0); g <= lat1; g++) gridLat.push(g);
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full overflow-hidden border border-line bg-[#eef3f8]" role="img" aria-label={`Locator chart for ${d.name}`}>
        <defs><clipPath id={`clip-${d.id}`}><rect width={W} height={H} /></clipPath></defs>
        <g clipPath={`url(#clip-${d.id})`} strokeLinejoin="round">
          {others.map((c) => <path key={c.name} d={path(c.rings)} fill="#ffffff" stroke="#838177" strokeOpacity=".6" strokeWidth=".7" />)}
          {near(india.medium as number[][][]) && <path d={path(india.medium as number[][][])} fill="#f6efe2" stroke="#233a50" strokeWidth="1" />}
        </g>
        <g stroke="#838177" strokeOpacity=".25" strokeWidth=".6">
          {grid.map((g) => <line key={g} x1={r(x(g))} x2={r(x(g))} y1={0} y2={H} />)}
          {gridLat.map((g) => <line key={g} y1={r(y(g))} y2={r(y(g))} x1={0} x2={W} />)}
        </g>
        <g fontFamily="var(--font-dm-mono)" fontSize="8" fill="#838177" letterSpacing=".8">
          {grid.map((g) => <text key={g} x={r(x(g)) + 3} y={H - 5}>{g}°E</text>)}
          {gridLat.map((g) => <text key={g} x={4} y={r(y(g)) - 3}>{g}°N</text>)}
        </g>
        {neighbours.map((n) => (
          <g key={n.id}>
            <circle cx={r(x(n.lng))} cy={r(y(n.lat))} r="2.4" fill="#233a50" opacity=".55" />
            <text x={r(x(n.lng)) + 5} y={r(y(n.lat)) + 3} fontFamily="var(--font-dm-mono)" fontSize="8" fill="#666f79" letterSpacing=".6">{n.name.toUpperCase()}</text>
          </g>
        ))}
        <circle cx={r(x(d.lng))} cy={r(y(d.lat))} r="10" fill="none" stroke="#233a50" />
        <circle cx={r(x(d.lng))} cy={r(y(d.lat))} r="4" fill="#233a50" />
        <text x={r(x(d.lng)) + 14} y={r(y(d.lat)) - 6} fontFamily="var(--font-fraunces)" fontSize="16" fill="#233a50">{d.name}</text>
      </svg>
      <figcaption className="mt-2 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-muted">{formatCoord(d.lat, "lat")} · {formatCoord(d.lng, "lng")} — {d.region} · boundaries as per India</figcaption>
    </figure>
  );
}
