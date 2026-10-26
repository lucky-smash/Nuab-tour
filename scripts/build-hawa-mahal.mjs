// Procedural Hawa Mahal (Jaipur) for the journey: the street facade as a stepped pyramid of storeys,
// each fronted by a row of semi-hexagonal jharokhas (bay windows) with lattice panels and domed caps,
// white lime cornices, an arcaded ground floor and chhatris on the step corners. A stylised model,
// not a survey; writes an OBJ with per-vertex colours for scripts/convert-landmark.mjs.
//
//   node scripts/build-hawa-mahal.mjs <out.obj>
//   npm run model:landmark -- <out.obj> public/models/landmarks/hawa-mahal.glb --crease 32
//
// Facade looks along +z, ground at y = 0 (the converter normalises size).
import { createMesh, hex } from "./lib/procedural-mesh.mjs";

const out = process.argv[2];
if (!out) {
  console.error("usage: node scripts/build-hawa-mahal.mjs <out.obj>");
  process.exit(1);
}

const PINK = hex("#de8f70"); // Jaipur pink sandstone
const PINK_LIGHT = hex("#e6a084"); // domes and caps catch more light
const TRIM = hex("#f3e9dc"); // white lime outlines
const LATTICE = hex("#7d4235"); // jali windows in shadow

const { tris, quad, box, prism, dome: domeBase, arch, writeObj } = createMesh();
const dome = (cx, y0, cz, r, h, col, seg = 10) => domeBase(cx, y0, cz, r, h, col, seg, TRIM);

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
writeObj(out, "Hawa Mahal (stylised, procedural) - scripts/build-hawa-mahal.mjs");
console.log(`${out}: ${tris.length} triangles, height ${y.toFixed(1)} + crown`);
