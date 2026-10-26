// Procedural Hawa Mahal (Jaipur) for the journey: the street facade as a stepped pyramid of storeys,
// each fronted by a row of semi-hexagonal jharokhas (bay windows) with lattice panels and domed caps,
// white lime cornices, an arcaded ground floor and chhatris on the step corners. A stylised model,
// not a survey; writes an OBJ with per-vertex colours for scripts/convert-landmark.mjs.
//
//   node scripts/build-hawa-mahal.mjs <out.obj>
//   npm run model:landmark -- <out.obj> public/models/landmarks/hawa-mahal.glb --crease 32
//
// Facade looks along +z, ground at y = 0 (the converter normalises size).
import fs from "node:fs";
import path from "node:path";

const out = process.argv[2];
if (!out) {
  console.error("usage: node scripts/build-hawa-mahal.mjs <out.obj>");
  process.exit(1);
}

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const PINK = hex("#de8f70"); // Jaipur pink sandstone
const PINK_LIGHT = hex("#e6a084"); // domes and caps catch more light
const TRIM = hex("#f3e9dc"); // white lime outlines
const LATTICE = hex("#7d4235"); // jali windows in shadow

// ---- mesh helpers: triangles with a colour; winding fixed against an outward hint -----------------
const tris = [];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
function tri(a, b, c, col, outward) {
  const n = cross(sub(b, a), sub(c, a));
  tris.push(dot(n, outward) >= 0 ? [a, b, c, col] : [a, c, b, col]);
}
function quad(a, b, c, d, col, outward) {
  tri(a, b, c, col, outward);
  tri(a, c, d, col, outward);
}
function box(x0, x1, y0, y1, z0, z1, col) {
  const p = (x, y, z) => [x, y, z];
  quad(p(x0, y0, z1), p(x1, y0, z1), p(x1, y1, z1), p(x0, y1, z1), col, [0, 0, 1]);
  quad(p(x0, y0, z0), p(x1, y0, z0), p(x1, y1, z0), p(x0, y1, z0), col, [0, 0, -1]);
  quad(p(x0, y0, z0), p(x0, y0, z1), p(x0, y1, z1), p(x0, y1, z0), col, [-1, 0, 0]);
  quad(p(x1, y0, z0), p(x1, y0, z1), p(x1, y1, z1), p(x1, y1, z0), col, [1, 0, 0]);
  quad(p(x0, y1, z0), p(x1, y1, z0), p(x1, y1, z1), p(x0, y1, z1), col, [0, 1, 0]);
  quad(p(x0, y0, z0), p(x1, y0, z0), p(x1, y0, z1), p(x0, y0, z1), col, [0, -1, 0]);
}
/** vertical prism over a convex xz polygon (closed) */
function prism(poly, y0, y1, col, { bottom = true } = {}) {
  const cx = poly.reduce((s, q) => s + q[0], 0) / poly.length, cz = poly.reduce((s, q) => s + q[1], 0) / poly.length;
  for (let i = 0; i < poly.length; i++) {
    const [ax, az] = poly[i], [bx, bz] = poly[(i + 1) % poly.length];
    const out = [(ax + bx) / 2 - cx, 0, (az + bz) / 2 - cz];
    quad([ax, y0, az], [bx, y0, bz], [bx, y1, bz], [ax, y1, az], col, out);
  }
  for (let i = 1; i < poly.length - 1; i++) {
    tri([poly[0][0], y1, poly[0][1]], [poly[i][0], y1, poly[i][1]], [poly[i + 1][0], y1, poly[i + 1][1]], col, [0, 1, 0]);
    if (bottom) tri([poly[0][0], y0, poly[0][1]], [poly[i][0], y0, poly[i][1]], [poly[i + 1][0], y0, poly[i + 1][1]], col, [0, -1, 0]);
  }
}
const ngon = (cx, cz, r, n, rot = 0) => Array.from({ length: n }, (_, i) => [cx + r * Math.cos(rot + (2 * Math.PI * i) / n), cz + r * Math.sin(rot + (2 * Math.PI * i) / n)]);
/** onion-ish dome: a slight bulge, drawn to a point, with a slender finial */
function dome(cx, y0, cz, r, h, col, seg = 10) {
  const prof = [[1, 0], [1.08, 0.18], [1.02, 0.4], [0.8, 0.62], [0.48, 0.82], [0.16, 0.95]];
  const ring = (k) => Array.from({ length: seg }, (_, i) => {
    const a = (2 * Math.PI * i) / seg;
    return [cx + r * prof[k][0] * Math.cos(a), y0 + h * prof[k][1], cz + r * prof[k][0] * Math.sin(a)];
  });
  for (let k = 0; k < prof.length - 1; k++) {
    const A = ring(k), B = ring(k + 1);
    for (let i = 0; i < seg; i++) {
      const j = (i + 1) % seg;
      quad(A[i], A[j], B[j], B[i], col, sub(A[i], [cx, y0, cz]));
    }
  }
  const top = ring(prof.length - 1), apex = [cx, y0 + h, cz];
  for (let i = 0; i < seg; i++) tri(top[i], top[(i + 1) % seg], apex, col, [0, 1, 0]);
  // finial: thin square spike
  const f = r * 0.09, fy = y0 + h * 0.97;
  const fp = [[cx - f, cz - f], [cx + f, cz - f], [cx + f, cz + f], [cx - f, cz + f]];
  for (let i = 0; i < 4; i++) {
    const [ax, az] = fp[i], [bx, bz] = fp[(i + 1) % 4];
    tri([ax, fy, az], [bx, fy, bz], [cx, fy + h * 0.42, cz], TRIM, [(ax + bx) / 2 - cx, 0.2, (az + bz) / 2 - cz]);
  }
}
/** flat arch panel (rectangle with a round top) in the plane z, facing +z */
function arch(cx, y0, w, h, z, col) {
  const r = w / 2, spring = y0 + h - r, pts = [[cx - r, y0], [cx + r, y0]];
  for (let i = 0; i <= 8; i++) {
    const a = (Math.PI * i) / 8;
    pts.push([cx + r * Math.cos(a), spring + r * Math.sin(a)]);
  }
  const c = [cx, y0 + h * 0.45, z];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    tri(c, [a[0], a[1], z], [b[0], b[1], z], col, [0, 0, 1]);
  }
}

// ---- one jharokha: semi-hexagonal bay against the wall at z = zw --------------------------------
function jharokha(x, y0, h, w, d, zw) {
  const foot = (s, dd) => [[x - (w * s) / 2, zw], [x + (w * s) / 2, zw], [x + (w * s) / 4, zw + dd], [x - (w * s) / 4, zw + dd]];
  prism(foot(1.12, d + 0.12), y0 - 0.22, y0, TRIM); // white sill / bracket
  prism(foot(1, d), y0, y0 + h, PINK);
  prism(foot(1.1, d + 0.1), y0 + h, y0 + h + 0.2, TRIM); // white eave
  // white-framed lattice panels on the three outer faces, nudged off the surface
  const faces = [
    [[x + w / 2, zw], [x + w / 4, zw + d]],
    [[x + w / 4, zw + d], [x - w / 4, zw + d]],
    [[x - w / 4, zw + d], [x - w / 2, zw]],
  ];
  for (const [[ax, az], [bx, bz]] of faces) {
    const nx = bz - az, nz = -(bx - ax), nl = Math.hypot(nx, nz);
    const panel = (t0, t1, v0, v1, off, col) => {
      const at = (t) => [ax + (bx - ax) * t + (nx / nl) * off, az + (bz - az) * t + (nz / nl) * off];
      const [p0x, p0z] = at(t0), [p1x, p1z] = at(t1), ya = y0 + h * v0, yb = y0 + h * v1;
      quad([p0x, ya, p0z], [p1x, ya, p1z], [p1x, yb, p1z], [p0x, yb, p0z], col, [nx, 0, nz]);
    };
    panel(0.12, 0.88, 0.1, 0.86, 0.025, TRIM);
    panel(0.22, 0.78, 0.2, 0.76, 0.05, LATTICE);
  }
  dome(x, y0 + h + 0.2, zw + d * 0.42, w * 0.34, 1.05, PINK_LIGHT, 8);
}

/** chhatri: four slim pillars and a dome on a square slab */
function chhatri(x, y0, z, s) {
  box(x - s, x + s, y0, y0 + 0.2, z - s, z + s, TRIM);
  const p = s * 0.72, t = s * 0.14, ph = s * 1.6;
  for (const [px, pz] of [[-p, -p], [p, -p], [p, p], [-p, p]]) box(x + px - t, x + px + t, y0 + 0.2, y0 + 0.2 + ph, z + pz - t, z + pz + t, PINK);
  box(x - s * 1.05, x + s * 1.05, y0 + 0.2 + ph, y0 + 0.4 + ph, z - s * 1.05, z + s * 1.05, TRIM);
  dome(x, y0 + 0.4 + ph, z, s * 0.9, s * 1.5, PINK_LIGHT, 10);
}

// ---- the facade --------------------------------------------------------------------------------
const STOREYS = [
  { w: 48, h: 4.4, depth: 12, arcade: true },
  { w: 48, h: 3.6, depth: 10 },
  { w: 42, h: 3.6, depth: 7 },
  { w: 34, h: 3.6, depth: 5.5 },
  { w: 25, h: 3.6, depth: 4.5 },
  { w: 15, h: 3.4, depth: 3.8 },
  { w: 7, h: 2.8, depth: 3.2 },
];
const BAY = 2.75;
let y = 0;
box(-25, 25, -0.3, 0, -13, 1.6, TRIM); // plinth
STOREYS.forEach((s, i) => {
  const half = s.w / 2;
  box(-half, half, y, y + s.h, -s.depth, 0, PINK); // wall
  box(-half - 0.15, half + 0.15, y + s.h - 0.28, y + s.h, -s.depth - 0.15, 0.4, TRIM); // cornice
  if (s.arcade) {
    // ground floor: a central gateway and rows of arched niches, white outlines behind dark openings
    arch(0, y + 0.1, 4.2, 3.7, 0.03, TRIM);
    arch(0, y + 0.1, 3.6, 3.4, 0.06, LATTICE);
    for (let k = 1; k <= 7; k++) {
      for (const sgn of [-1, 1]) {
        const x = sgn * (1.6 + k * 2.9);
        arch(x, y + 0.6, 1.9, 2.9, 0.03, TRIM);
        arch(x, y + 0.75, 1.4, 2.5, 0.06, LATTICE);
      }
    }
  } else {
    const n = Math.max(1, Math.floor((s.w - 0.6) / BAY));
    for (let k = 0; k < n; k++) {
      const x = (k - (n - 1) / 2) * BAY;
      jharokha(x, y + 0.45, s.h - 1.55, 2.25, 0.95, 0);
    }
  }
  // chhatris on the terrace corners where the next storey steps back
  const next = STOREYS[i + 1];
  if (next && next.w < s.w - 3) for (const sgn of [-1, 1]) chhatri(sgn * (half - 1.4), y + s.h, -1.2, 0.85);
  y += s.h;
});
// crown: a central dome flanked by two smaller ones
dome(0, y, -1.6, 1.9, 3.1, PINK_LIGHT, 12);
for (const sgn of [-1, 1]) dome(sgn * 2.5, y, -1.6, 0.95, 1.8, PINK_LIGHT, 10);

// ---- OBJ ---------------------------------------------------------------------------------------
const lines = [`# Hawa Mahal (stylised, procedural) - scripts/build-hawa-mahal.mjs`];
const f = (v) => +v.toFixed(4);
let vi = 1;
const faces = [];
for (const [a, b, c, col] of tris) {
  for (const p of [a, b, c]) lines.push(`v ${f(p[0])} ${f(p[1])} ${f(p[2])} ${col.map((x) => x.toFixed(4)).join(" ")}`);
  faces.push(`f ${vi} ${vi + 1} ${vi + 2}`);
  vi += 3;
}
fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
fs.writeFileSync(out, lines.concat(faces).join("\n") + "\n");
console.log(`${out}: ${tris.length} triangles, height ${y.toFixed(1)} + crown`);
