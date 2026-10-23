/**
 * Builds the map geometry used across the site from Natural Earth's *India point-of-view*
 * country dataset (ne_10m_admin_0_countries_ind), so India is shown with its official boundary
 * (the whole of Jammu & Kashmir and Ladakh, including the areas administered by Pakistan and
 * China) everywhere: the 3D atlas, the "Beyond India" chart and the live MapLibre map.
 *
 * Outputs
 *  - src/data/geo/india.json            India outline, lightly simplified (3D atlas + charts)
 *  - src/data/geo/region.json           country outlines 40–110°E, 0–45°N, simplified (charts)
 *  - public/geo/borders-ind.geojson     India-POV international boundaries for MapLibre
 *
 * Source: Natural Earth (public domain), https://www.naturalearthdata.com/ — "point of view" set.
 * Run: npm run geo:build   (downloads once into .cache/geo, parsed as plain JSON only)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const CACHE = path.join(ROOT, ".cache", "geo");
const SRC_URL = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_countries_ind.geojson";
const SRC_FILE = path.join(CACHE, "ne_10m_admin_0_countries_ind.geojson");

fs.mkdirSync(CACHE, { recursive: true });
if (!fs.existsSync(SRC_FILE)) {
  console.log("downloading", SRC_URL);
  const r = await fetch(SRC_URL);
  if (!r.ok) throw new Error("download failed " + r.status);
  fs.writeFileSync(SRC_FILE, Buffer.from(await r.arrayBuffer()));
}
const fc = JSON.parse(fs.readFileSync(SRC_FILE, "utf8"));

// --- Douglas–Peucker on [lng, lat] rings ------------------------------------
function simplify(points, tol) {
  if (points.length <= 4) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  const t2 = tol * tol;
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = points[a], [bx, by] = points[b];
    const dx = bx - ax, dy = by - ay, len = dx * dx + dy * dy;
    let best = -1, bi = -1;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = points[i];
      let t = len ? ((px - ax) * dx + (py - ay) * dy) / len : 0;
      t = Math.max(0, Math.min(1, t));
      const ex = ax + t * dx - px, ey = ay + t * dy - py;
      const d = ex * ex + ey * ey;
      if (d > best) { best = d; bi = i; }
    }
    if (best > t2) { keep[bi] = 1; stack.push([a, bi], [bi, b]); }
  }
  return points.filter((_, i) => keep[i]);
}
const round = (n) => Math.round(n * 1e4) / 1e4;
const polys = (g) => (g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : []);
const bboxOf = (rings) => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const r of rings) for (const [x, y] of r) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return [x0, y0, x1, y1];
};
const ringArea = (r) => { let a = 0; for (let i = 0; i < r.length - 1; i++) a += r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1]; return Math.abs(a / 2); };
const name = (f) => f.properties.ADMIN || f.properties.NAME || f.properties.name;

// Outer rings only (holes are irrelevant at these scales), dropping specks below minArea (deg²)
function outerRings(feature, tol, minArea) {
  return polys(feature.geometry)
    .map((p) => p[0])
    .filter((r) => ringArea(r) >= minArea)
    .map((r) => simplify(r, tol).map(([x, y]) => [round(x), round(y)]))
    .filter((r) => r.length >= 4);
}

const india = fc.features.find((f) => name(f) === "India");
if (!india) throw new Error("India feature not found");

// 1. India outline (atlas ground + charts)
const indiaRings = outerRings(india, 0.004, 0.002);
fs.mkdirSync(path.join(ROOT, "src/data/geo"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "src/data/geo/india.json"), JSON.stringify({ source: "Natural Earth 1:10m admin-0, India point of view", bbox: bboxOf(indiaRings), rings: indiaRings, medium: outerRings(india, 0.02, 0.01) }));

// 2. Regional outlines for the international chart (40–110°E, 0–45°N)
const REGION = [40, 0, 110, 45];
const inRegion = (bb) => !(bb[2] < REGION[0] || bb[0] > REGION[2] || bb[3] < REGION[1] || bb[1] > REGION[3]);
const region = [];
for (const f of fc.features) {
  const rings = outerRings(f, 0.14, 0.35);
  if (rings.length && inRegion(bboxOf(rings))) region.push({ name: name(f), iso: f.properties.ISO_A3 || f.properties.ADM0_A3, rings });
}
fs.writeFileSync(path.join(ROOT, "src/data/geo/region.json"), JSON.stringify({ source: "Natural Earth 1:10m admin-0, India point of view", bbox: REGION, countries: region }));

// 3. India-POV international boundaries for the live map (South Asia, Gulf, SE Asia)
const MAPBOX = [44, -2, 110, 42];
// Countries around the three map views: North India, the UAE and Thailand
const NEAR = new Set(["India", "Pakistan", "China", "Nepal", "Bhutan", "Bangladesh", "Myanmar", "Sri Lanka", "Afghanistan", "United Arab Emirates", "Oman", "Saudi Arabia", "Qatar", "Iran", "Thailand", "Laos", "Cambodia", "Malaysia", "Vietnam"]);
const feats = [];
for (const f of fc.features) {
  if (!NEAR.has(name(f))) continue;
  const rings = outerRings(f, name(f) === "India" ? 0.006 : 0.02, 0.003);
  const bb = bboxOf(rings);
  if (!rings.length || bb[2] < MAPBOX[0] || bb[0] > MAPBOX[2] || bb[3] < MAPBOX[1] || bb[1] > MAPBOX[3]) continue;
  feats.push({ type: "Feature", properties: { name: name(f), india: name(f) === "India" }, geometry: { type: "MultiPolygon", coordinates: rings.map((r) => [r]) } });
}
fs.mkdirSync(path.join(ROOT, "public/geo"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "public/geo/borders-ind.geojson"), JSON.stringify({ type: "FeatureCollection", features: feats }));

const size = (p) => (fs.statSync(path.join(ROOT, p)).size / 1024).toFixed(0) + " KB";
console.log(`india rings: ${indiaRings.length} (${indiaRings.reduce((a, r) => a + r.length, 0)} pts) ${size("src/data/geo/india.json")}`);
console.log(`region countries: ${region.length} ${size("src/data/geo/region.json")}`);
console.log(`map borders: ${feats.length} countries ${size("public/geo/borders-ind.geojson")}`);
console.log("india bbox", bboxOf(indiaRings));
