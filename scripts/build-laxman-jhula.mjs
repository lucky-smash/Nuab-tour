// Procedural Laxman Jhula (Rishikesh) for the journey: the suspension bridge across the Ganga between
// stepped stone ghats, with its two cream tower gates (legs, pointed-arch panels, saffron domes), the
// sagging main cables, back-stays, hangers and railings, and the tiered Tera Manzil temple on the far
// bank. A stylised model after the line engraving, not a survey; writes an OBJ with per-vertex
// colours for scripts/convert-landmark.mjs.
//
//   node scripts/build-laxman-jhula.mjs <out.obj>
//   npm run model:landmark -- <out.obj> public/models/landmarks/laxman-jhula.glb --crease 32 --ao-strength 0.6
//
// The bridge runs along x, its side elevation looks along +z, ground at y = 0.
import { createMesh, hex } from "./lib/procedural-mesh.mjs";

const out = process.argv[2];
if (!out) {
  console.error("usage: node scripts/build-laxman-jhula.mjs <out.obj>");
  process.exit(1);
}

const WATER = hex("#7fa8ab"); // Ganga green
const STONE = hex("#cdbfa4"); // ghats
const STEP = hex("#b8a98d");
const TOWER = hex("#efe6d6"); // cream lime-washed towers
const SHADE = hex("#d6c4a4"); // cornices, recessed panels
const SAFFRON = hex("#e07a3a");
const STEEL = hex("#4a6674"); // cables, hangers, railings
const DECK = hex("#8f8c84");
const WINDOW = hex("#6a5143");

const { tris, box, dome, arch, beam, writeObj } = createMesh();
const BANK_TOP = 7, DECK_Y = 8, TOWER_X = 30, TOP = 33, SPAN_HALF = 52;

// ---- river and ghats ---------------------------------------------------------------------------
// the water runs from the foot of one ghat to the other (no faces shared with the steps) and stands
// 0.8 deep, so its surface sits well clear of the contact shadow and route line on the atlas (no z-fighting)
const STEPS_FOOT = 27 - 1.6 * 3;
box(-STEPS_FOOT, STEPS_FOOT, 0, 0.8, -16, 16, WATER);
for (const s of [-1, 1]) {
  const span = (a, b) => [Math.min(s * a, s * b), Math.max(s * a, s * b)];
  box(...span(27, 58), 0, BANK_TOP, -16, 16, STONE);
  for (let k = 0; k < 3; k++) box(...span(27 - 1.6 * (k + 1), 27 - 1.6 * k), 0, BANK_TOP * (1 - (k + 1) / 4), -16, 16, k % 2 ? STONE : STEP);
}

// ---- tower gates -----------------------------------------------------------------------------------
for (const s of [-1, 1]) {
  const x = s * TOWER_X;
  for (const zs of [-1, 1]) {
    const [z0, z1] = zs > 0 ? [2.7, 4.7] : [-4.7, -2.7];
    box(x - 3, x + 3, BANK_TOP, TOP, z0, z1, TOWER); // leg
    // recessed pointed-arch panel and string courses on the outer face of each leg
    arch(x, BANK_TOP + 3, 3.4, 15, zs * 4.72, SHADE, { pointed: true, sign: zs });
    for (const y of [BANK_TOP + 1.2, 25.5]) box(x - 3.15, x + 3.15, y, y + 0.45, z0 - 0.1 * (zs < 0), z1 + 0.1 * (zs > 0), SHADE);
  }
  box(x - 3, x + 3, 26.5, TOP, -2.7, 2.7, TOWER); // lintel over the deck portal
  for (const xs of [-1, 1]) arch(0, DECK_Y + 0.2, 4.6, 17.8, x + xs * 3.02, WINDOW, { axis: "x", sign: xs, pointed: true }); // portal shadow
  box(x - 3.7, x + 3.7, TOP, TOP + 1.2, -5.4, 5.4, SHADE); // cornice
  dome(x, TOP + 1.2, 0, 2.9, 4.6, SAFFRON, 12, SHADE);
  for (const [cx, cz] of [[-2.8, -4.4], [2.8, -4.4], [-2.8, 4.4], [2.8, 4.4]]) dome(x + cx, TOP + 1.2, cz, 0.75, 1.5, SAFFRON, 8, SHADE);
}

// ---- deck and railings -------------------------------------------------------------------------------
box(-SPAN_HALF, SPAN_HALF, DECK_Y - 0.6, DECK_Y, -2.3, 2.3, DECK);
for (const z of [-2.25, 2.25]) {
  beam([-SPAN_HALF, DECK_Y + 1.4, z], [SPAN_HALF, DECK_Y + 1.4, z], 0.09, STEEL);
  for (let x = -SPAN_HALF; x <= SPAN_HALF; x += 3) beam([x, DECK_Y, z], [x, DECK_Y + 1.4, z], 0.07, STEEL);
}

// ---- main cables, back-stays, hangers --------------------------------------------------------------
const CABLE_Z = 3.7;
const cable = (x) => DECK_Y + 1.8 + (TOP - 1 - DECK_Y - 1.8) * (x / TOWER_X) ** 2;
for (const z of [-CABLE_Z, CABLE_Z]) {
  for (let x = -TOWER_X; x < TOWER_X; x += 2.5) beam([x, cable(x), z], [x + 2.5, cable(x + 2.5), z], 0.2, STEEL);
  for (const s of [-1, 1]) {
    beam([s * TOWER_X, TOP - 1, z], [s * (SPAN_HALF - 2), BANK_TOP + 0.6, z], 0.2, STEEL);
    box(s * (SPAN_HALF - 2) - 1, s * (SPAN_HALF - 2) + 1, BANK_TOP, BANK_TOP + 1, z - 1, z + 1, SHADE); // anchor
  }
  for (let x = -TOWER_X + 2.5; x <= TOWER_X - 2.5; x += 2.5) beam([x, cable(x), z], [x, DECK_Y, Math.sign(z) * 2.3], 0.06, STEEL);
}

// ---- Tera Manzil: the tiered temple on the far bank --------------------------------------------------
let y = BANK_TOP, w = 10.5;
const tx = -45, tz = -9;
for (let i = 0; i < 11; i++) {
  const h = 2.5 - i * 0.04;
  box(tx - w / 2, tx + w / 2, y, y + h, tz - w / 2, tz + w / 2, TOWER);
  box(tx - w / 2 + 0.6, tx + w / 2 - 0.6, y + 0.6, y + h - 0.7, tz - w / 2 - 0.05, tz + w / 2 + 0.05, WINDOW); // window bands
  box(tx - w / 2 - 0.05, tx + w / 2 + 0.05, y + 0.6, y + h - 0.7, tz - w / 2 + 0.6, tz + w / 2 - 0.6, WINDOW);
  box(tx - w / 2 - 0.5, tx + w / 2 + 0.5, y + h - 0.32, y + h, tz - w / 2 - 0.5, tz + w / 2 + 0.5, SAFFRON); // roof band
  y += h;
  w *= 0.93;
}
dome(tx, y, tz, w * 0.45, 4.2, SAFFRON, 12, SHADE);

writeObj(out, "Laxman Jhula (stylised, procedural) - scripts/build-laxman-jhula.mjs");
console.log(`${out}: ${tris.length} triangles, temple top ${y.toFixed(1)}`);
