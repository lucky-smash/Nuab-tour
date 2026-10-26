"use client";

import { Suspense, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, type ThreeElements } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { getDrawing } from "@/components/engraving/drawings";
import { STOPS, toWorld } from "./config";
import { journey, progressToU, activeStop, stopFrames, cameraKey, landmarkPosition, poseCameraAt } from "./journeyMath";
import { formatCoord } from "@/lib/site";

// ---------------------------------------------------------------------------
// Engravings standing on the atlas at each stop. Segments are sorted bottom-up and revealed with
// drawRange as the aircraft approaches; they turn (about Y) to face the camera like a cut-out.
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Zones: every monument belongs to one part of the journey — the hero skyline (home p = 0) or its
// own stop (home p = the stop). It is shown exactly while the camera naturally sees it around that
// home: the stretch of the camera path (sampled with the rig's own composition, for the current
// viewport) during which it is in frame. So it enters and leaves at the edge of the screen — never
// rising, sinking or popping — and never appears in another part of the journey (e.g. the Delhi
// view holds India Gate alone). Visibility is a pure function of progress: scrolling back up shows
// exactly the same thing.
// ---------------------------------------------------------------------------
const ZONE_SAMPLES = 400;
const ZONE_MARGIN = 0.015; // extra progress while out of frame, covering the rig's camera damping
const _zoneCam = new THREE.PerspectiveCamera(36, 1, 0.3, 2000);
const _frustum = new THREE.Frustum();
const _vp = new THREE.Matrix4();
const _box = new THREE.Box3();
const _tmpBox = new THREE.Box3();

function worldBox(obj: THREE.Object3D, out: THREE.Box3) {
  obj.updateWorldMatrix(true, true);
  out.makeEmpty();
  obj.traverse((o) => {
    const g = (o as THREE.Mesh).geometry;
    if (!g) return;
    if (!g.boundingBox) g.computeBoundingBox();
    out.union(_tmpBox.copy(g.boundingBox!).applyMatrix4(o.matrixWorld));
  });
  return out;
}

function computeZone(obj: THREE.Object3D, home: number, width: number, height: number): [number, number] | null {
  if (worldBox(obj, _box).isEmpty()) return null; // model not loaded yet
  const N = ZONE_SAMPLES;
  const seen: boolean[] = [];
  for (let i = 0; i <= N; i++) {
    poseCameraAt(i / N, width, height, _zoneCam);
    _vp.multiplyMatrices(_zoneCam.projectionMatrix, _zoneCam.matrixWorldInverse);
    seen.push(_frustum.setFromProjectionMatrix(_vp).intersectsBox(_box));
  }
  let h = Math.round(home * N);
  if (!seen[h]) {
    // not in frame exactly at home: take the nearest stretch where it is (within ±0.1)
    let best = -1;
    for (let d = 1; d <= N * 0.1 && best < 0; d++) {
      if (seen[h - d]) best = h - d;
      else if (seen[h + d]) best = h + d;
    }
    if (best < 0) return [Math.max(0, home - 0.12), home + 0.13];
    h = best;
  }
  let a = h, b = h;
  while (a > 0 && seen[a - 1]) a--;
  while (b < N && seen[b + 1]) b++;
  // widen by the margin, but only across samples where it is out of frame (never into another stretch)
  let lo = a, hi = b;
  const m = Math.round(ZONE_MARGIN * N);
  while (lo > 0 && a - lo < m && !seen[lo - 1] && !seen[Math.max(0, lo - 2)]) lo--;
  while (hi < N && hi - b < m && !seen[hi + 1] && !seen[Math.min(N, hi + 2)]) hi++;
  return [a === 0 ? 0 : lo / N, b === N ? 1 : hi / N];
}

function useZone(get: () => THREE.Object3D | null | undefined, home: number) {
  const zone = useRef<{ key: string; z: [number, number] } | null>(null);
  useFrame(({ size }) => {
    const o = get();
    if (!o) return;
    const key = `${size.width}x${size.height}`;
    if (!zone.current || zone.current.key !== key) {
      const z = computeZone(o, home, size.width, size.height);
      if (!z) return;
      zone.current = { key, z };
    }
    const p = journey.current;
    o.visible = p >= zone.current.z[0] && p <= zone.current.z[1];
  });
}

function ZoneGroup({ home, children, ...props }: { home: number; children: React.ReactNode } & ThreeElements["group"]) {
  const ref = useRef<THREE.Group>(null);
  useZone(() => ref.current, home);
  return (
    <group ref={ref} {...props}>
      {children}
    </group>
  );
}

const ENGRAVING_SCALE = 0.36;

function engravingGeometry(id: string) {
  const d = getDrawing(id);
  const build = (lines: [number, number][][]) => {
    const segs: { y: number; a: [number, number]; b: [number, number] }[] = [];
    for (const pl of lines) for (let i = 0; i < pl.length - 1; i++) segs.push({ y: Math.min(pl[i][1], pl[i + 1][1]), a: pl[i], b: pl[i + 1] });
    segs.sort((s, t) => s.y - t.y);
    const arr = new Float32Array(segs.length * 6);
    segs.forEach((s, i) => {
      arr.set([s.a[0] * ENGRAVING_SCALE, s.a[1] * ENGRAVING_SCALE, 0, s.b[0] * ENGRAVING_SCALE, s.b[1] * ENGRAVING_SCALE, 0], i * 6);
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(arr, 3));
    return { g, count: segs.length * 2 };
  };
  return { main: build(d.main), hatch: build(d.hatch) };
}

export function Engravings() {
  const items = useMemo(
    () =>
      STOPS.flatMap((s, i) => {
        if (s.model && s.model.atStop !== false) return []; // a real 3D model stands at this stop instead (LandmarkModels)
        const geo = engravingGeometry(s.engraving);
        const mainMat = new THREE.LineBasicMaterial({ color: "#233a50", transparent: true, opacity: 0.9, fog: true });
        const hatchMat = new THREE.LineBasicMaterial({ color: "#838177", transparent: true, opacity: 0.5, fog: true });
        return [{ stop: s, pos: stopFrames()[i].engraving.clone(), geo, mainMat, hatchMat }];
      }),
    [],
  );
  const groups = useRef<(THREE.Group | null)[]>([]);
  useFrame(({ camera }) => {
    items.forEach((it, i) => {
      const g = groups.current[i];
      if (!g) return;
      // monuments stay on the atlas for the whole journey (no draw-in, no fade)
      // face the camera around the vertical axis
      const dx = camera.position.x - g.position.x, dz = camera.position.z - g.position.z;
      g.rotation.y = Math.atan2(dx, dz);
    });
  });
  return (
    <group>
      {items.map((it, i) => (
        <ZoneGroup key={it.stop.id} home={it.stop.p} name={`engraving-${it.stop.id}`}>
          <group position={it.pos} ref={(el) => { groups.current[i] = el; }}>
            <lineSegments geometry={it.geo.hatch.g} material={it.hatchMat} />
            <lineSegments geometry={it.geo.main.g} material={it.mainMat} />
          </group>
        </ZoneGroup>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Real landmark models (where a stop has one): textured GLB standing across from the aircraft,
// turned so its main facade meets the camera at the stop. Monuments are permanent: they stand on
// the atlas for the whole journey, never rising, sinking or fading.
// ---------------------------------------------------------------------------
const FACADE_YAW = { "+x": Math.PI / 2, "-x": -Math.PI / 2, "+z": 0, "-z": Math.PI } as const;

function contactShadowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, "rgba(35,43,52,0.42)");
  grad.addColorStop(0.55, "rgba(35,43,52,0.16)");
  grad.addColorStop(1, "rgba(35,43,52,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function LandmarkModel({ index }: { index: number }) {
  const stop = STOPS[index];
  const m = stop.model!;
  const { scene } = useGLTF(m.url);
  const built = useMemo(() => {
    const f = stopFrames()[index];
    // camera position at the stop (desktop composition): look from the monument back to it
    const c = cameraKey(stop.p);
    const cam = f.plane.clone().addScaledVector(f.side, c.side).addScaledVector(f.head, -c.back);
    const at = landmarkPosition(index);
    const toCam = Math.atan2(cam.x - at.x, cam.z - at.z);
    const rotY = toCam - FACADE_YAW[m.facade ?? "+z"] + ((m.yaw ?? 0) * Math.PI) / 180;
    const root = scene.clone(true);
    const mats: THREE.MeshStandardMaterial[] = [];
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mat = (mesh.material as THREE.MeshStandardMaterial).clone();
      mat.envMapIntensity = mat.map ? 0.55 : 0.35; // untextured marble: shading from the baked AO + key light
      if (mat.map) mat.map.anisotropy = 8;
      mesh.material = mat;
      mats.push(mat);
    });
    const shadow = new THREE.MeshBasicMaterial({ map: contactShadowTexture(), transparent: true, depthWrite: false, opacity: 1 });
    return { root, pos: at, rotY, mats, shadow };
  }, [scene, index, stop.p, m.facade, m.yaw]);
  const group = useRef<THREE.Group>(null);
  useZone(() => group.current, stop.p);
  return (
    <group ref={group} position={built.pos} name={`landmark-${stop.id}`}>
      <mesh rotation-x={-Math.PI / 2} position-y={0.06} material={built.shadow} renderOrder={-1}>
        <planeGeometry args={[m.height * 1.5, m.height * 1.5]} />
      </mesh>
      <primitive object={built.root} rotation-y={built.rotY} scale={m.height} />
    </group>
  );
}

export function LandmarkModels() {
  return (
    <>
      {STOPS.map((s, i) =>
        s.model && s.model.atStop !== false ? (
          <Suspense key={s.id} fallback={null}>
            <LandmarkModel index={i} />
          </Suspense>
        ) : null,
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Hero skyline: the journey's monuments standing on the distant horizon of the first viewport —
// the background layer behind the aircraft. Monuments without a real model are drawn in sandstone
// linework. Like every monument, they stay in place for the whole journey.
// ---------------------------------------------------------------------------
const SKYLINE: { id: string; yaw: number; dist: number; scale: number }[] = [
  { id: "hawa-mahal", yaw: 29, dist: 190, scale: 0.5 },
  { id: "temple", yaw: 16, dist: 195, scale: 0.46 },
  { id: "taj-mahal", yaw: -6, dist: 175, scale: 0.62 },
  { id: "india-gate", yaw: -19, dist: 165, scale: 0.46 }, // real model (HeroLandmarkModels): clear sky right of the tail
];

export function HeroSkyline({ curve }: { curve: THREE.Curve<THREE.Vector3> }) {
  const items = useMemo(() => {
    const p0 = curve.getPointAt(0);
    const t0 = curve.getTangentAt(0);
    const head = new THREE.Vector3(t0.x, 0, t0.z).normalize();
    const side = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), head).normalize();
    // hero camera sits ahead-left of the aircraft (see CAM_KEYS[0]); look back past it
    const cam = p0.clone().addScaledVector(side, 10.2).addScaledVector(head, 11.6);
    const view = new THREE.Vector3(p0.x - cam.x, 0, p0.z - cam.z).normalize();
    return SKYLINE.flatMap((s) => {
      if (heroModelFor(s.id)) return []; // a real 3D model stands here instead (HeroLandmarkModels)
      const d = view.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), (s.yaw * Math.PI) / 180);
      const pos = new THREE.Vector3(cam.x, 0, cam.z).addScaledVector(d, s.dist);
      const geo = engravingGeometry(s.id);
      const scale = s.scale / ENGRAVING_SCALE;
      const main = new THREE.LineBasicMaterial({ color: "#9c7f58", transparent: true, opacity: 0.62, fog: false, depthWrite: false });
      const hatch = new THREE.LineBasicMaterial({ color: "#c6a77b", transparent: true, opacity: 0.42, fog: false, depthWrite: false });
      const rotY = Math.atan2(cam.x - pos.x, cam.z - pos.z);
      return [{ key: s.id, pos, geo, scale, main, hatch, rotY }];
    });
  }, [curve]);
  const group = useRef<THREE.Group>(null);
  useZone(() => group.current, 0);
  return (
    <group ref={group} name="hero-skyline">
      {items.map((it) => (
        <group key={it.key} position={it.pos} rotation-y={it.rotY} scale={it.scale} renderOrder={-1}>
          <lineSegments geometry={it.geo.hatch.g} material={it.hatch} />
          <lineSegments geometry={it.geo.main.g} material={it.main} />
        </group>
      ))}
    </group>
  );
}

/** The hero camera (CAM_KEYS[0] composition) and its horizontal view direction. */
function heroView(curve: THREE.Curve<THREE.Vector3>) {
  const p0 = curve.getPointAt(0);
  const t0 = curve.getTangentAt(0);
  const head = new THREE.Vector3(t0.x, 0, t0.z).normalize();
  const side = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), head).normalize();
  const cam = p0.clone().addScaledVector(side, 10.2).addScaledVector(head, 11.6);
  const view = new THREE.Vector3(p0.x - cam.x, 0, p0.z - cam.z).normalize();
  return { cam, view };
}

/** A skyline monument that has a real model (taken from the stop that owns that engraving). */
function heroModelFor(id: string) {
  // hero: false keeps the line engraving there (e.g. the Taj sits behind the aircraft's fuselage in the
  // hero composition; see-through linework reads there, a solid model would simply be hidden)
  return STOPS.find((s) => s.engraving === id && s.model && s.model.hero !== false)?.model;
}

// Real models on the hero skyline: placed like the engravings (yaw/dist from the hero camera), sized
// to the engraving's height. Permanent, like every monument.
const HERO_MODEL_PLACEMENT: Record<string, { yaw: number; dist: number; height: number; turn?: number; fog?: boolean }> = {
  "india-gate": { yaw: -11, dist: 100, height: 25, turn: 18 },
  // the classic poster view: far behind the aircraft, dome and minarets rising above the fuselage
  "taj-mahal": { yaw: 0.5, dist: 210, height: 45, turn: 0, fog: false },
  // left of the nose: shikhara and entrance pavilions in three-quarter view
  temple: { yaw: 14, dist: 190, height: 34, turn: 30, fog: false },
  // where its engraving stood, behind the hero copy (the paragraph sits on a .mist-pad so it stays legible)
  "hawa-mahal": { yaw: 29, dist: 190, height: 24, turn: 8, fog: false },
};

function HeroLandmarkModel({ curve, id }: { curve: THREE.Curve<THREE.Vector3>; id: string }) {
  const m = heroModelFor(id)!;
  const place = HERO_MODEL_PLACEMENT[id] ?? { yaw: SKYLINE.find((s) => s.id === id)?.yaw ?? 0, dist: 170, height: 30 };
  const { scene } = useGLTF(m.url);
  const built = useMemo(() => {
    const { cam, view } = heroView(curve);
    const d = view.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), (place.yaw * Math.PI) / 180);
    const pos = new THREE.Vector3(cam.x, 0, cam.z).addScaledVector(d, place.dist);
    const toCam = Math.atan2(cam.x - pos.x, cam.z - pos.z);
    const rotY = toCam - FACADE_YAW[m.facade ?? "+z"] + (((place.turn ?? m.yaw ?? 0) as number) * Math.PI) / 180;
    const root = scene.clone(true);
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mat = (mesh.material as THREE.MeshStandardMaterial).clone();
      mat.envMapIntensity = mat.map ? 0.6 : 0.35;
      if (place.fog === false) mat.fog = false;
      mesh.material = mat;
    });
    return { root, pos, rotY };
  }, [scene, curve, place.yaw, place.dist, place.turn, place.fog, m.facade, m.yaw]);
  const group = useRef<THREE.Group>(null);
  useZone(() => group.current, 0);
  return (
    <group ref={group} position={built.pos} name={`hero-landmark-${id}`}>
      <primitive object={built.root} rotation-y={built.rotY} scale={place.height} />
    </group>
  );
}

export function HeroLandmarkModels({ curve }: { curve: THREE.Curve<THREE.Vector3> }) {
  return (
    <>
      {SKYLINE.filter((s) => heroModelFor(s.id)).map((s) => (
        <Suspense key={s.id} fallback={null}>
          <HeroLandmarkModel curve={curve} id={s.id} />
        </Suspense>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Route: a fine navy contrail drawn behind the aircraft at flight level, and the full itinerary
// dashed on the atlas below (the planned journey, shown like an atlas route — not a road).
// ---------------------------------------------------------------------------
export function RouteLines({ curve }: { curve: THREE.Curve<THREE.Vector3> }) {
  const N = 700;
  const { contrail, contrailGeo, ground } = useMemo(() => {
    const pts: number[] = [];
    const gpts: THREE.Vector3[] = [];
    for (let i = 0; i <= N; i++) {
      const p = curve.getPointAt(i / N);
      pts.push(p.x, p.y - 0.15, p.z);
      gpts.push(new THREE.Vector3(p.x, 0.08, p.z));
    }
    const contrailGeo = new LineGeometry();
    contrailGeo.setPositions(pts);
    const mat = new LineMaterial({ color: 0x233a50, linewidth: 1.6, transparent: true, opacity: 0.7, worldUnits: false, fog: true });
    const contrail = new Line2(contrailGeo, mat);
    contrail.computeLineDistances();
    contrail.frustumCulled = false;

    const gg = new THREE.BufferGeometry().setFromPoints(gpts);
    const gm = new THREE.LineDashedMaterial({ color: 0x233a50, dashSize: 1.6, gapSize: 1.2, transparent: true, opacity: 0.45, fog: true });
    const ground = new THREE.Line(gg, gm);
    ground.computeLineDistances();
    return { contrail, contrailGeo, ground };
  }, [curve]);

  useFrame(({ size }) => {
    const u = progressToU(journey.current);
    // keep the line just behind the aircraft so it never pokes through the fuselage
    contrailGeo.instanceCount = Math.max(0, Math.floor(u * N) - 4);
    (contrail.material as LineMaterial).resolution.set(size.width, size.height);
  });
  return (
    <group>
      <primitive object={contrail} />
      <primitive object={ground} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// Stop markers: ground ring + pin + a small DM Mono label sprite that appears when active.
// ---------------------------------------------------------------------------
function labelTexture(lines: [string, string]) {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 192;
  const ctx = c.getContext("2d")!;
  const mono = getComputedStyle(document.documentElement).getPropertyValue("--font-dm-mono").trim() || "monospace";
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  const w1 = (() => { ctx.font = `500 64px ${mono}`; return ctx.measureText(lines[0]).width; })();
  ctx.fillRect(0, 22, Math.min(1024, w1 + 56), 148);
  ctx.fillStyle = "#233a50";
  ctx.fillRect(0, 22, 6, 148);
  ctx.font = `500 64px ${mono}`;
  ctx.fillText(lines[0], 28, 92);
  ctx.fillStyle = "#666f79";
  ctx.font = `400 40px ${mono}`;
  ctx.fillText(lines[1], 28, 146);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function StopMarkers() {
  const items = useMemo(
    () =>
      STOPS.map((s) => {
        const [x, z] = toWorld(s.lat, s.lng);
        const tex = typeof document !== "undefined" ? labelTexture([s.title.toUpperCase(), `${formatCoord(s.lat, "lat")}  ${formatCoord(s.lng, "lng")}`]) : null;
        return { s, x, z, tex };
      }),
    [],
  );
  const refs = useRef<{ ring: THREE.Mesh | null; pin: THREE.Mesh | null; label: THREE.Sprite | null }[]>(STOPS.map(() => ({ ring: null, pin: null, label: null })));
  useFrame(({ clock }) => {
    const { index, strength } = activeStop(journey.current);
    refs.current.forEach((r, i) => {
      const k = i === index ? strength : 0;
      if (r.ring) {
        const pulse = 1 + k * 0.25 * (0.5 + 0.5 * Math.sin(clock.elapsedTime * 2.4));
        r.ring.scale.setScalar(pulse);
        (r.ring.material as THREE.MeshBasicMaterial).opacity = 0.35 + 0.65 * k;
      }
      if (r.pin) (r.pin.material as THREE.MeshBasicMaterial).opacity = 0.15 + 0.6 * k;
      if (r.label) { (r.label.material as THREE.SpriteMaterial).opacity = k; r.label.visible = k > 0.01; }
    });
  });
  return (
    <group>
      {items.map((it, i) => (
        <group key={it.s.id} position={[it.x, 0, it.z]}>
          <mesh rotation-x={-Math.PI / 2} position-y={0.12} ref={(el) => { refs.current[i].ring = el; }}>
            <ringGeometry args={[2.1, 2.45, 48]} />
            <meshBasicMaterial color="#233a50" transparent opacity={0.4} depthWrite={false} />
          </mesh>
          <mesh position-y={6} ref={(el) => { refs.current[i].pin = el; }}>
            <cylinderGeometry args={[0.05, 0.05, 12, 6]} />
            <meshBasicMaterial color="#233a50" transparent opacity={0.2} />
          </mesh>
          {it.tex && (
            <sprite position={[5.2, 12.8, 0]} scale={[10.5, 1.97, 1]} ref={(el) => { refs.current[i].label = el; }}>
              <spriteMaterial map={it.tex} transparent depthWrite={false} opacity={0} fog={false} />
            </sprite>
          )}
        </group>
      ))}
    </group>
  );
}
