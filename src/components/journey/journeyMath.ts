import * as THREE from "three";
import { STOPS, STOP_WAYPOINT_INDEX, flightWaypoints, ARRIVAL_P } from "./config";

/**
 * Shared, mutable journey state. Written by the ScrollTrigger (DOM side) and read inside
 * useFrame (WebGL side) — no React state, so scrolling never re-renders the React tree.
 */
export const journey = {
  /** raw scroll progress 0..1 from ScrollTrigger */
  target: 0,
  /** damped progress used for rendering */
  current: 0,
  /** set when the stage is offscreen so the render loop can idle */
  visible: true,
  /** reduced complexity (mobile / low-power) */
  lite: false,
  /** narrow (portrait) composition */
  portrait: false,
  /** QA: skip damping so screenshots show the settled pose immediately */
  snap: false,
};

/**
 * Shared 3D stage state (WebGL side only). The sun direction is chosen once, from the hero
 * composition, so the sunrise glow sits behind the aircraft in the first viewport.
 */
export const stage = {
  sun: new THREE.Vector3(0.4, 0.18, -0.9).normalize(),
  sunReady: false,
  plane: new THREE.Vector3(),
  /** 0 → 1 entrance of the aircraft into the hero composition */
  intro: 0,
};

export const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

let _curve: THREE.CatmullRomCurve3 | null = null;
let _stopU: number[] | null = null;

export function getCurve() {
  if (!_curve) {
    const pts = flightWaypoints().map((p) => new THREE.Vector3(...p));
    _curve = new THREE.CatmullRomCurve3(pts, false, "centripetal", 0.5);
    _curve.arcLengthDivisions = 2000;
  }
  return _curve;
}

/** Arc-length parameter u of each stop's waypoint. */
export function stopU(): number[] {
  if (_stopU) return _stopU;
  const curve = getCurve();
  const wps = flightWaypoints();
  const N = 2000;
  const samples = Array.from({ length: N + 1 }, (_, i) => curve.getPointAt(i / N));
  _stopU = STOP_WAYPOINT_INDEX.map((wi) => {
    const w = new THREE.Vector3(...wps[wi]);
    let best = 0, bd = Infinity;
    samples.forEach((s, i) => { const d = s.distanceToSquared(w); if (d < bd) { bd = d; best = i; } });
    return best / N;
  });
  return _stopU;
}

/**
 * Scroll progress -> curve parameter. Piecewise between stops with a sine ease, so the aircraft
 * glides slowly past each landmark (while its story is on screen) and covers legs briskly.
 */
export function progressToU(p: number): number {
  const su = stopU();
  const knots: [number, number][] = [[0, 0], ...STOPS.map((s, i) => [s.p, su[i]] as [number, number]), [1, 1]];
  for (let i = 0; i < knots.length - 1; i++) {
    const [p0, u0] = knots[i];
    const [p1, u1] = knots[i + 1];
    if (p <= p1 || i === knots.length - 2) {
      const t = clamp01((p - p0) / (p1 - p0));
      const e = 0.5 - 0.5 * Math.cos(Math.PI * t);
      // blend eased + linear so the plane never fully stops
      return lerp(u0, u1, lerp(t, e, 0.72));
    }
  }
  return 1;
}

/**
 * Composition of each stop, derived once from the flight curve:
 *  - camSign: which side of the aircraft the camera takes (+1 = aircraft's left). Chosen from the
 *    text layout so the nose always points into the frame, towards the text column.
 *  - engraving: the landmark stands across from the aircraft on the far side (slightly ahead), so
 *    the aircraft crosses in front of the monument. (Ground markers stay at the true coordinates.)
 */
export type StopFrame = { plane: THREE.Vector3; head: THREE.Vector3; side: THREE.Vector3; camSign: number; engraving: THREE.Vector3 };
let _frames: StopFrame[] | null = null;
export function stopFrames(): StopFrame[] {
  if (_frames) return _frames;
  const curve = getCurve();
  const us = stopU();
  const UPV = new THREE.Vector3(0, 1, 0);
  _frames = STOPS.map((s, i) => {
    const plane = curve.getPointAt(us[i]);
    const t = curve.getTangentAt(us[i]);
    const head = new THREE.Vector3(t.x, 0, t.z).normalize();
    const side = new THREE.Vector3().crossVectors(UPV, head).normalize();
    // camera on the aircraft's left => nose points screen-left (into a left text column? no:
    // text-left layouts put the aircraft on the right, so its nose should point left)
    const camSign = s.layout === "left" ? 1 : -1;
    const engraving = new THREE.Vector3(plane.x, 0, plane.z).addScaledVector(side, -camSign * 34).addScaledVector(head, 6);
    return { plane, head, side, camSign, engraving };
  });
  CAM_KEYS.forEach((k) => { if (k.stop != null) k.side = Math.abs(k.side) * _frames![k.stop].camSign; });
  return _frames;
}

/** Where a stop's real landmark model stands: the engraving spot unless the model sets an offset. */
export function landmarkPosition(i: number): THREE.Vector3 {
  const f = stopFrames()[i];
  const o = STOPS[i].model?.offset;
  if (!o) return f.engraving.clone();
  return new THREE.Vector3(f.plane.x, 0, f.plane.z).addScaledVector(f.side, -f.camSign * (o.across ?? 34)).addScaledVector(f.head, o.ahead ?? 6);
}

/** Which stop is "active" at progress p, and how strongly (0..1). */
export function activeStop(p: number): { index: number; strength: number } {
  let index = -1, strength = 0;
  STOPS.forEach((s, i) => {
    const d = Math.abs(p - s.p);
    const k = 1 - smoothstep(0.035, 0.085, d);
    if (k > strength) { strength = k; index = i; }
  });
  if (p > ARRIVAL_P - 0.02) return { index: -1, strength: 0 };
  return { index, strength };
}

// ---------------------------------------------------------------------------
// Camera composition keyframes
//   side: + = to the aircraft's left (screen right of heading), up: height, back: + behind
//   look: look-ahead distance along heading, frame: horizontal frame offset (−1..1, + pushes
//   the aircraft to the right of the screen to leave room for text on the left)
// ---------------------------------------------------------------------------
export type CamKey = { p: number; side: number; up: number; back: number; look: number; lookUp: number; fov: number; frame: number; stop?: number };
const K = (p: number, side: number, up: number, back: number, look: number, lookUp: number, fov: number, frame: number, stop?: number): CamKey => ({ p, side, up, back, look, lookUp, fov, frame, stop });

export const CAM_KEYS: CamKey[] = [
  K(0.0, 10.2, -0.7, -11.6, 0.6, 0.55, 34, 0.25), // hero: low three-quarter front (a touch below the wing), aircraft right of headline
  K(0.05, 13, 3.4, -10, 3, 1.4, 35, 0.28),
  // Stop keys: |side| is a magnitude; the sign is resolved at runtime so the camera always sits
  // opposite the landmark and the aircraft crosses in front of the engraving.
  K(0.105, 25, 9, 8, 3, 3.4, 38, 0.3, 0), // Delhi: high beam — the aircraft passes below the India Gate model beyond it; text left
  K(0.19, -7, 7.5, 26, 10, 0, 40, 0), // cruise chase
  K(0.27, 25, 12, 8, 3, 4, 38, -0.3, 1), // Agra: text right, aircraft left; high beam so the aircraft passes below the Taj model
  K(0.37, 7, 8, 25, 10, 0, 40, 0),
  K(0.46, 25, 12, 8, 3, 4, 38, 0.3, 2), // Jaipur: high beam so the aircraft passes below the Hawa Mahal model
  K(0.555, -7, 8, 25, 10, 0, 40, 0),
  K(0.645, 25, 12, 8, 3, 4, 38, -0.3, 3), // Mathura–Vrindavan: high beam so the aircraft passes below the temple model
  K(0.74, 6, 9, 26, 10, 0, 40, 0),
  K(0.83, 25, 12, 8, 3, 4, 38, 0.3, 4), // Haridwar–Rishikesh: high beam so the aircraft passes below Laxman Jhula
  K(0.92, -4, 9, 28, 16, 3, 42, 0), // climbing toward the Himalaya
  K(1.0, -2, 12, 36, 24, 7, 44, 0),
];

export function cameraKey(p: number): CamKey {
  const ks = CAM_KEYS;
  if (p <= ks[0].p) return ks[0];
  for (let i = 0; i < ks.length - 1; i++) {
    const a = ks[i], b = ks[i + 1];
    if (p <= b.p) {
      const t = 0.5 - 0.5 * Math.cos(Math.PI * clamp01((p - a.p) / (b.p - a.p)));
      const o = {} as CamKey;
      const NUM = ["p", "side", "up", "back", "look", "lookUp", "fov", "frame"] as const;
      NUM.forEach((k) => (o[k] = lerp(a[k], b[k], t)));
      return o;
    }
  }
  return ks[ks.length - 1];
}

/**
 * Camera composition at progress p, in the horizontal heading frame `head` (the flight rig passes its
 * smoothed heading). Shared by the rig and by the landmark visibility zones, so both see one camera.
 */
const _UP = new THREE.Vector3(0, 1, 0);
const _side = new THREE.Vector3();
export function composeCamera(p: number, width: number, height: number, pos: THREE.Vector3, head: THREE.Vector3, outCam: THREE.Vector3, outLook: THREE.Vector3) {
  const c = cameraKey(p);
  const portrait = width < height * 0.85;
  const dist = portrait ? 1.45 : width < 1100 ? 1.15 : 1;
  _side.crossVectors(_UP, head).normalize(); // + = aircraft's left
  outCam.copy(pos).addScaledVector(_side, c.side * dist).addScaledVector(_UP, c.up * (portrait ? 1.25 : 1)).addScaledVector(head, -c.back * dist);
  outLook.copy(pos).addScaledVector(head, c.look).addScaledVector(_UP, c.lookUp);
  // frame: horizontal shift so the aircraft sits beside the text column; vshift: portrait puts the
  // aircraft in the upper third, text sheet below
  return { fov: portrait ? c.fov * 1.25 : c.fov, frame: portrait ? 0 : c.frame, vshift: portrait ? 0.34 : 0 };
}

const _pp = new THREE.Vector3(), _pt = new THREE.Vector3(), _ph = new THREE.Vector3(), _pc = new THREE.Vector3(), _pl = new THREE.Vector3();
/** Pose `cam` exactly as the settled flight rig would at progress p (no damping). */
export function poseCameraAt(p: number, width: number, height: number, cam: THREE.PerspectiveCamera) {
  const curve = getCurve();
  const u = progressToU(p);
  curve.getPointAt(u, _pp);
  curve.getTangentAt(u, _pt);
  _ph.set(_pt.x, 0, _pt.z).normalize();
  const f = composeCamera(p, width, height, _pp, _ph, _pc, _pl);
  cam.position.copy(_pc);
  cam.lookAt(_pl);
  cam.fov = f.fov;
  cam.aspect = width / height;
  cam.setViewOffset(width, height, -f.frame * width * 0.5, f.vshift * height, width, height);
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld();
}

// Sky palette along the journey: [p, zenith, sky blue, horizon, sun glow, sun strength]
// Dawn over Delhi, warm sandstone light at Agra/Jaipur, cooler mountain air toward the Himalaya.
type SkyKey = [number, string, string, string, string, number];
const SKY: SkyKey[] = [
  [0.0, "#3f73a8", "#a8c9e8", "#f6e4ca", "#ffbf7f", 1.0],
  [0.105, "#4a7cb0", "#a8c9e8", "#efe6d9", "#ffd09b", 0.75],
  [0.27, "#5283b5", "#b0cde9", "#f4e5d0", "#ffcf98", 0.65],
  [0.46, "#5583b2", "#b3cde6", "#f5e0d0", "#ffc49a", 0.65],
  [0.645, "#5384b4", "#b1cde8", "#f4e5cd", "#ffd096", 0.65],
  [0.83, "#477aae", "#a6c6e6", "#e5edf5", "#ffe0b4", 0.55],
  [0.92, "#4375a9", "#a2c2e3", "#e7eef6", "#ffe4c2", 0.5],
  [1.0, "#3f71a6", "#a0c0e2", "#eef3f8", "#ffe9cc", 0.5],
];
const _c1 = new THREE.Color(), _c2 = new THREE.Color();
export type SkyState = { zenith: THREE.Color; mid: THREE.Color; horizon: THREE.Color; glow: THREE.Color; sun: number };
export function skyColors(p: number, out: SkyState) {
  for (let i = 0; i < SKY.length - 1; i++) {
    const a = SKY[i], b = SKY[i + 1];
    if (p <= b[0] || i === SKY.length - 2) {
      const t = clamp01((p - a[0]) / (b[0] - a[0]));
      out.zenith.copy(_c1.set(a[1])).lerp(_c2.set(b[1]), t);
      out.mid.copy(_c1.set(a[2])).lerp(_c2.set(b[2]), t);
      out.horizon.copy(_c1.set(a[3])).lerp(_c2.set(b[3]), t);
      out.glow.copy(_c1.set(a[4])).lerp(_c2.set(b[4]), t);
      out.sun = lerp(a[5], b[5], t);
      return;
    }
  }
}

/** Deterministic PRNG (mulberry32) — identical clouds on every load. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
