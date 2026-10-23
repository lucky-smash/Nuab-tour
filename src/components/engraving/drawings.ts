/**
 * Procedural fine-line "engravings" of the journey landmarks.
 *
 * Coordinate space: x ∈ [-50, 50], y ∈ [0, ~95] with y pointing UP (ground at y = 0).
 * Each drawing is a set of polylines; `main` strokes are the architecture, `hatch` strokes are
 * lighter shading lines. The same data renders as SVG (DOM) and as THREE.LineSegments (3D scene).
 */
export type Pt = [number, number];
export type Polyline = Pt[];
export type Drawing = { id: string; label: string; main: Polyline[]; hatch: Polyline[]; width: number; height: number };

// ---------------------------------------------------------------------------
// primitives
// ---------------------------------------------------------------------------
const rect = (x0: number, y0: number, x1: number, y1: number): Polyline => [[x0, y0], [x0, y1], [x1, y1], [x1, y0], [x0, y0]];
const line = (x0: number, y0: number, x1: number, y1: number): Polyline => [[x0, y0], [x1, y1]];
const hline = (x0: number, x1: number, y: number): Polyline => [[x0, y], [x1, y]];
const vline = (x: number, y0: number, y1: number): Polyline => [[x, y0], [x, y1]];

/** Circular arc (degrees, CCW from +x) */
function arc(cx: number, cy: number, r: number, a0: number, a1: number, n = 24, ry = r): Polyline {
  const out: Polyline = [];
  for (let i = 0; i <= n; i++) {
    const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180;
    out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * ry]);
  }
  return out;
}

/** Mughal pointed (four-centred) arch opening: jambs + pointed head. */
function pointedArch(cx: number, base: number, w: number, spring: number, apex: number, n = 14): Polyline {
  const hw = w / 2;
  const out: Polyline = [[cx - hw, base], [cx - hw, spring]];
  // left curve: quadratic-ish bulge rising to apex
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const x = cx - hw + hw * t;
    const y = spring + (apex - spring) * Math.sin((t * Math.PI) / 2) ** 0.85;
    out.push([x - Math.sin(t * Math.PI) * hw * 0.08, y]);
  }
  for (let i = n - 1; i >= 0; i--) {
    const t = i / n;
    const x = cx + hw - hw * t;
    const y = spring + (apex - spring) * Math.sin((t * Math.PI) / 2) ** 0.85;
    out.push([x + Math.sin(t * Math.PI) * hw * 0.08, y]);
  }
  out.push([cx + hw, base]);
  return out;
}

/** Onion dome profile from drum (y0, half-width hw) to apex. */
function onionDome(cx: number, y0: number, hw: number, belly: number, apex: number, n = 28): Polyline {
  const pts: Polyline = [];
  const h = apex - y0;
  for (let i = 0; i <= n; i++) {
    const t = i / n; // 0 base → 1 apex
    const y = y0 + h * t;
    // bulge: grows to `belly` around t≈0.32 then pinches to a point with a slight reverse curve
    const w = t < 0.32 ? hw + (belly - hw) * Math.sin((t / 0.32) * (Math.PI / 2)) : belly * Math.cos(((t - 0.32) / 0.68) * (Math.PI / 2)) ** 1.25 * (1 - 0.18 * Math.sin((t - 0.32) / 0.68 * Math.PI));
    pts.push([cx - w, y]);
  }
  const right = pts.slice(0, -1).reverse().map(([x, y]) => [2 * cx - x, y] as Pt);
  return [...pts, ...right];
}

function finial(cx: number, y0: number, h: number): Polyline[] {
  return [vline(cx, y0, y0 + h), arc(cx, y0 + h * 0.35, h * 0.12, 0, 360, 12), arc(cx, y0 + h * 0.62, h * 0.08, 0, 360, 10), hline(cx - h * 0.12, cx + h * 0.12, y0 + h * 0.85)];
}

/** Evenly spaced hatch lines clipped to a profile function (x range at height y). */
function hatchRows(y0: number, y1: number, step: number, range: (y: number) => [number, number] | null): Polyline[] {
  const out: Polyline[] = [];
  for (let y = y0; y <= y1; y += step) {
    const r = range(y);
    if (r && r[1] - r[0] > 0.6) out.push(hline(r[0], r[1], y));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Taj Mahal — Agra
// ---------------------------------------------------------------------------
function tajMahal(): Drawing {
  const main: Polyline[] = [];
  const hatch: Polyline[] = [];
  // ground + plinth (chameli farsh) with steps
  main.push(hline(-50, 50, 0), rect(-44, 0, 44, 5), hline(-44, 44, 3.2));
  for (let x = -40; x <= 40; x += 4) hatch.push(vline(x, 0.4, 3));
  // main body with chamfered corner bays
  main.push([[-24, 5], [-24, 33], [24, 33], [24, 5]], vline(-17, 5, 33), vline(17, 5, 33), hline(-24, 24, 31.5));
  // central iwan: frame + nested pointed arches
  main.push(rect(-9.5, 5, 9.5, 32), pointedArch(0, 5, 14, 19, 29.5), pointedArch(0, 5, 10.5, 17, 25.5));
  for (let x = -4.5; x <= 4.5; x += 1.5) hatch.push(vline(x, 5.5, 16.5 + (4.5 - Math.abs(x)) * 1.4));
  main.push(hline(-9.5, 9.5, 30.5));
  // flanking two-tier arches on the front face and the chamfers
  for (const cx of [-13.25, 13.25, -20.5, 20.5]) {
    main.push(pointedArch(cx, 6, cx * cx > 300 ? 4.6 : 5.6, 11.5, 16.5, 10), pointedArch(cx, 19, cx * cx > 300 ? 4.6 : 5.6, 24.5, 29.5, 10));
    for (let x = -1.6; x <= 1.6; x += 1.07) hatch.push(vline(cx + x, 6.6, 11), vline(cx + x, 19.6, 24));
  }
  // drum + onion dome + finial
  main.push(rect(-9.5, 33, 9.5, 39), hline(-9.5, 9.5, 36));
  const dome = onionDome(0, 39, 9.5, 12.2, 61);
  main.push(dome);
  // dome shading on the left side
  hatch.push(...hatchRows(40.5, 57, 1.25, (y) => {
    const left = dome.filter((p) => Math.abs(p[1] - y) < 0.6 && p[0] < 0).map((p) => p[0]);
    if (!left.length) return null;
    const x0 = Math.min(...left);
    return [x0 + 0.5, x0 + (Math.abs(x0) * 0.45)];
  }));
  main.push(...finial(0, 61, 9));
  // chhatris
  for (const cx of [-16, 16]) {
    main.push(rect(cx - 3.6, 33, cx + 3.6, 37.4), vline(cx - 1.2, 33, 37.4), vline(cx + 1.2, 33, 37.4));
    main.push(onionDome(cx, 37.4, 3.6, 4.4, 45, 18), ...finial(cx, 45, 3.6));
  }
  // minarets
  for (const cx of [-39.5, 39.5]) {
    const taper = (y: number) => 2.1 - (y - 5) * 0.012;
    main.push([[cx - taper(5), 5], [cx - taper(50), 50]], [[cx + taper(5), 5], [cx + taper(50), 50]]);
    for (const y of [18, 31, 44]) main.push(rect(cx - taper(y) - 1.3, y, cx + taper(y) + 1.3, y + 1.1));
    for (let y = 8; y < 50; y += 2.6) hatch.push(hline(cx - taper(y) + 0.3, cx - taper(y) * 0.1, y));
    main.push(rect(cx - 2.6, 50, cx + 2.6, 52.6), onionDome(cx, 52.6, 2.6, 3.1, 58, 14), ...finial(cx, 58, 2.6));
  }
  // garden / reflecting channel in front
  main.push(hline(-50, -30, -3), hline(30, 50, -3));
  hatch.push(hline(-2.5, 2.5, -1.6), hline(-1.6, 1.6, -3), hline(-0.8, 0.8, -4.2));
  return { id: "taj-mahal", label: "Taj Mahal, Agra", main, hatch, width: 100, height: 72 };
}

// ---------------------------------------------------------------------------
// Hawa Mahal — Jaipur
// ---------------------------------------------------------------------------
function hawaMahal(): Drawing {
  const main: Polyline[] = [];
  const hatch: Polyline[] = [];
  main.push(hline(-50, 50, 0));
  // ground storey with a central gateway
  main.push(rect(-46, 0, 46, 12), pointedArch(0, 0, 8, 6, 10.5, 10));
  for (let x = -42; x <= 42; x += 6) if (Math.abs(x) > 6) main.push(pointedArch(x, 2, 3, 6.2, 9, 8));
  // honeycomb of jharokha bays rising to a pyramidal crown
  const rows = [
    { n: 11, y: 12, h: 10.5, w: 8.2 },
    { n: 9, y: 22.5, h: 10, w: 8.2 },
    { n: 7, y: 32.5, h: 9.5, w: 8.2 },
    { n: 5, y: 42, h: 9, w: 8.2 },
    { n: 3, y: 51, h: 8.5, w: 8.2 },
  ];
  for (const r of rows) {
    const total = r.n * r.w;
    main.push(hline(-total / 2 - 0.6, total / 2 + 0.6, r.y), hline(-total / 2 - 0.6, total / 2 + 0.6, r.y + 1.1));
    for (let i = 0; i < r.n; i++) {
      const cx = -total / 2 + r.w * (i + 0.5);
      const x0 = cx - r.w / 2 + 0.7, x1 = cx + r.w / 2 - 0.7;
      // projecting bay (semi-octagonal suggested by inner verticals)
      main.push([[x0, r.y + 1.1], [x0, r.y + r.h * 0.62], [x1, r.y + r.h * 0.62], [x1, r.y + 1.1]]);
      main.push(vline(cx - 1.3, r.y + 1.1, r.y + r.h * 0.62), vline(cx + 1.3, r.y + 1.1, r.y + r.h * 0.62));
      // small arched window
      main.push(pointedArch(cx, r.y + 2, 1.9, r.y + 4.4, r.y + 5.6, 6));
      // curved chhajja + cupola roof
      main.push(arc(cx, r.y + r.h * 0.62, (r.w / 2) - 0.4, 180, 0, 14, r.h * 0.3));
      main.push(vline(cx, r.y + r.h * 0.92, r.y + r.h));
      for (let x = x0 + 0.5; x < cx - 1.5; x += 0.9) hatch.push(vline(x, r.y + 1.6, r.y + r.h * 0.55));
    }
    // outer stepped edge
    main.push(vline(-total / 2 - 0.6, r.y, r.y + r.h), vline(total / 2 + 0.6, r.y, r.y + r.h));
  }
  // crown
  main.push(rect(-6, 59.5, 6, 62), onionDome(0, 62, 4.5, 5.4, 70, 18), ...finial(0, 70, 4));
  for (const cx of [-8.5, 8.5]) main.push(onionDome(cx, 59.5, 2, 2.4, 64, 12), vline(cx, 64, 66));
  return { id: "hawa-mahal", label: "Hawa Mahal, Jaipur", main, hatch, width: 100, height: 76 };
}

// ---------------------------------------------------------------------------
// India Gate — Delhi
// ---------------------------------------------------------------------------
function indiaGate(): Drawing {
  const main: Polyline[] = [];
  const hatch: Polyline[] = [];
  main.push(hline(-50, 50, 0), rect(-28, 0, 28, 3), rect(-25, 3, 25, 5));
  // main mass
  main.push([[-22, 5], [-22, 46], [22, 46], [22, 5]]);
  // central arch with archivolts
  main.push([[-9, 5], [-9, 25], ...arc(0, 25, 9, 180, 0, 24), [9, 5]]);
  main.push(arc(0, 25, 11, 180, 0, 26), arc(0, 25, 12.2, 180, 0, 28));
  for (let x = -8; x <= 8; x += 1.2) hatch.push(vline(x, 5.5, 25 + Math.sqrt(Math.max(0, 81 - x * x)) - 0.8));
  // piers + string courses
  main.push(vline(-15, 5, 46), vline(15, 5, 46), hline(-22, 22, 38), hline(-22, 22, 43.5));
  // inscription band
  for (let x = -12; x < 12; x += 1.4) hatch.push(hline(x, x + 0.9, 40.8));
  // side niches
  for (const cx of [-18.5, 18.5]) main.push(rect(cx - 1.8, 9, cx + 1.8, 30), arc(cx, 30, 1.8, 180, 0, 8));
  // cornice + attic + bowl
  main.push(rect(-23.5, 46, 23.5, 48.5), rect(-17, 48.5, 17, 56), hline(-17, 17, 52));
  main.push(rect(-10, 56, 10, 58.5), [[-9, 58.5], ...arc(0, 58.5, 9, 180, 0, 20, 3.2), [9, 58.5]]);
  hatch.push(...hatchRows(49.5, 55, 1.1, () => [-16.5, -12]));
  // flanking lamp posts
  for (const cx of [-40, 40]) main.push(vline(cx, 0, 14), arc(cx, 15, 1.4, 0, 360, 10), hline(cx - 2, cx + 2, 1));
  return { id: "india-gate", label: "India Gate, Delhi", main, hatch, width: 100, height: 64 };
}

// ---------------------------------------------------------------------------
// Temple (Prem Mandir / Braj temples) — Mathura–Vrindavan
// ---------------------------------------------------------------------------
function temple(): Drawing {
  const main: Polyline[] = [];
  const hatch: Polyline[] = [];
  main.push(hline(-50, 50, 0), rect(-42, 0, 42, 4), rect(-36, 4, 36, 8.5), hline(-36, 36, 6.2));
  // steps
  for (let i = 0; i < 4; i++) main.push(hline(-6 + i * 0.6, 6 - i * 0.6, 1 + i * 2.2));
  // colonnaded mandapa
  main.push(hline(-31, 31, 9), hline(-32, 32, 27.5), hline(-33, 33, 29.5));
  for (let x = -29; x <= 29; x += 5.8) {
    main.push(vline(x - 0.7, 9, 27.5), vline(x + 0.7, 9, 27.5), hline(x - 1.3, x + 1.3, 26), hline(x - 1.1, x + 1.1, 10.2));
    if (x < 28) main.push(arc(x + 2.9, 22, 2.2, 180, 0, 10, 2.6));
  }
  for (let x = -27; x < 27; x += 1.45) if (((x + 29) % 5.8) > 1.3) hatch.push(vline(x, 10.5, 19.5));
  // eaves
  main.push([[-35, 29.5], [-31, 33], [31, 33], [35, 29.5]]);
  // main shikhara with horizontal courses
  const prof = (t: number) => 14 * (1 - t) ** 0.72 + 2.8 * t; // half-width along height
  const y0 = 33, y1 = 72;
  const left: Polyline = [], right: Polyline = [];
  for (let i = 0; i <= 30; i++) { const t = i / 30; const y = y0 + (y1 - y0) * t; left.push([-prof(t), y]); right.push([prof(t), y]); }
  main.push(left, right);
  for (let i = 1; i < 14; i++) { const t = i / 14; const y = y0 + (y1 - y0) * t; main.push(hline(-prof(t), prof(t), y)); }
  hatch.push(...hatchRows(34, 70, 0.95, (y) => { const t = (y - y0) / (y1 - y0); return [-prof(t) + 0.4, -prof(t) * 0.45]; }));
  // central projection (rathika)
  main.push(vline(-3.5, 33, 66), vline(3.5, 33, 66));
  // amalaka, kalash, flag
  main.push(arc(0, 73.5, 4.6, 0, 360, 24, 1.6), [[-1.8, 75], [-2.6, 77.5], [-1.2, 80], [1.2, 80], [2.6, 77.5], [1.8, 75]], vline(0, 80, 92), [[0, 92], [7, 89.5], [0, 87]]);
  // subsidiary shikharas
  for (const cx of [-20, 20]) {
    const p = (t: number) => 6 * (1 - t) ** 0.7 + 1.2 * t;
    const L: Polyline = [], R: Polyline = [];
    for (let i = 0; i <= 14; i++) { const t = i / 14; L.push([cx - p(t), 33 + 16 * t]); R.push([cx + p(t), 33 + 16 * t]); }
    main.push(L, R, arc(cx, 49.8, 2, 0, 360, 14, 0.8), vline(cx, 50.6, 54));
    for (let i = 1; i < 6; i++) { const t = i / 6; main.push(hline(cx - p(t), cx + p(t), 33 + 16 * t)); }
  }
  return { id: "temple", label: "Prem Mandir, Vrindavan", main, hatch, width: 100, height: 94 };
}

// ---------------------------------------------------------------------------
// Laxman Jhula & the foothills — Haridwar–Rishikesh
// ---------------------------------------------------------------------------
function jhula(): Drawing {
  const main: Polyline[] = [];
  const hatch: Polyline[] = [];
  // deterministic ridge lines
  const ridge = (base: number, amp: number, seed: number): Polyline => {
    const pts: Polyline = [];
    for (let x = -50; x <= 50; x += 2) {
      const y = base + amp * (0.55 * Math.sin(x * 0.11 + seed) + 0.3 * Math.sin(x * 0.27 + seed * 2.1) + 0.15 * Math.sin(x * 0.61 + seed * 3.7));
      pts.push([x, y]);
    }
    return pts;
  };
  const far = ridge(58, 9, 1.3), mid = ridge(44, 7, 4.1);
  main.push(far, mid);
  for (let x = -49; x <= 49; x += 1.6) {
    const yf = far.reduce((a, p) => (Math.abs(p[0] - x) < Math.abs(a[0] - x) ? p : a))[1];
    hatch.push(line(x, yf - 0.8, x - 1.4, yf - 4.2));
  }
  // river
  for (let i = 0; i < 4; i++) {
    const y = 2 + i * 2.2;
    const pts: Polyline = [];
    for (let x = -50; x <= 50; x += 2.5) pts.push([x, y + 0.35 * Math.sin(x * 0.5 + i)]);
    hatch.push(pts);
  }
  // banks
  main.push([[-50, 12], [-36, 11], [-30, 9.5]], [[50, 12], [36, 11], [30, 9.5]]);
  // suspension towers
  for (const cx of [-30, 30]) {
    main.push(rect(cx - 3, 9.5, cx + 3, 40), rect(cx - 3.8, 40, cx + 3.8, 42), pointedArch(cx, 16, 3.4, 30, 34, 8));
    main.push(onionDome(cx, 42, 2.6, 3, 47, 12), vline(cx, 47, 49));
    for (let y = 11; y < 40; y += 1.6) hatch.push(hline(cx - 2.6, cx - 1, y));
  }
  // main cable (catenary), back-stays and hangers
  const cable = (x: number) => 21 + 19 * (x / 30) ** 2;
  const cab: Polyline = [];
  for (let x = -30; x <= 30; x += 1.5) cab.push([x, cable(x)]);
  main.push(cab, [[-30, 40], [-48, 13]], [[30, 40], [48, 13]]);
  main.push(hline(-48, 48, 16), hline(-30, 30, 18.2));
  for (let x = -28.5; x <= 28.5; x += 1.5) main.push(vline(x, 16, cable(x)));
  // tiered temple tower on the far bank
  let w = 6.5, y = 12;
  const tx = -41.5;
  for (let i = 0; i < 9; i++) { const h = 4.4 - i * 0.18; main.push(rect(tx - w / 2, y, tx + w / 2, y + h), hline(tx - w / 2 - 0.6, tx + w / 2 + 0.6, y + h)); y += h; w *= 0.93; }
  main.push(onionDome(tx, y, w / 2, w / 2 + 0.4, y + 4, 10), vline(tx, y + 4, y + 6));
  return { id: "jhula", label: "Laxman Jhula, Rishikesh", main, hatch, width: 100, height: 70 };
}

// ---------------------------------------------------------------------------
// Himalaya — arrival
// ---------------------------------------------------------------------------
function himalaya(): Drawing {
  const main: Polyline[] = [];
  const hatch: Polyline[] = [];
  const peaks: [number, number, number][] = [[-34, 46, 18], [-12, 62, 22], [10, 52, 20], [33, 58, 19]];
  for (const [cx, h, w] of peaks) {
    const L: Polyline = [[cx - w * 1.6, 8], [cx - w * 0.7, h * 0.55], [cx - w * 0.25, h * 0.82], [cx, h]];
    const R: Polyline = [[cx, h], [cx + w * 0.35, h * 0.78], [cx + w * 0.8, h * 0.5], [cx + w * 1.6, 8]];
    main.push(L, R, [[cx - w * 0.25, h * 0.82], [cx - w * 0.05, h * 0.72], [cx + w * 0.2, h * 0.8]]);
    for (let i = 1; i < 14; i++) { const t = i / 14; hatch.push(line(cx + w * 0.05 * t, h - (h - 8) * t * 0.95, cx + w * 0.75 * t, h - (h - 8) * t * 0.75)); }
  }
  main.push(hline(-50, 50, 8));
  return { id: "himalaya", label: "Garhwal Himalaya", main, hatch, width: 100, height: 64 };
}

const cache = new Map<string, Drawing>();
const FACTORIES: Record<string, () => Drawing> = { "taj-mahal": tajMahal, "hawa-mahal": hawaMahal, "india-gate": indiaGate, temple, jhula, himalaya };
export type DrawingId = keyof typeof FACTORIES;
export const DRAWING_IDS = Object.keys(FACTORIES) as DrawingId[];

export function getDrawing(id: string): Drawing {
  if (!cache.has(id)) cache.set(id, (FACTORIES[id] ?? tajMahal)());
  return cache.get(id)!;
}

/** SVG path data with rounded coordinates (stable across server/client). y is flipped for SVG. */
export function toPathD(p: Polyline, height: number): string {
  const r = (n: number) => Math.round(n * 100) / 100;
  return p.map(([x, y], i) => `${i ? "L" : "M"}${r(x + 50)} ${r(height - y)}`).join("");
}
