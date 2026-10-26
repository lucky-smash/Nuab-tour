"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { journey, skyColors, rng, smoothstep, stage, stopFrames, cameraKey, landmarkPosition, type SkyState } from "./journeyMath";
import { ATLAS, STOPS, toWorld } from "./config";
import { DESTINATION_SEEDS } from "@/data/destinations";
import { formatCoord } from "@/lib/site";
import indiaGeo from "@/data/geo/india.json";

// ---------------------------------------------------------------------------
// Sky dome: zenith → sky blue → warm horizon, with a sunrise glow and soft sun disc placed behind
// the aircraft in the hero view. Scene fog takes the horizon haze so the atlas recedes naturally.
// ---------------------------------------------------------------------------
export function Sky() {
  const { scene } = useThree();
  const state = useMemo<SkyState>(() => ({ zenith: new THREE.Color(), mid: new THREE.Color(), horizon: new THREE.Color(), glow: new THREE.Color(), sun: 1 }), []);
  const fogCol = useMemo(() => new THREE.Color(), []);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          zenith: { value: new THREE.Color("#3f73a8") },
          mid: { value: new THREE.Color("#a8c9e8") },
          horizon: { value: new THREE.Color("#f6e4ca") },
          glow: { value: new THREE.Color("#ffbf7f") },
          sun: { value: stage.sun.clone() },
          sunStrength: { value: 1 },
        },
        vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = modelViewMatrix * vec4(position,1.); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w; }`,
        fragmentShader: `uniform vec3 zenith; uniform vec3 mid; uniform vec3 horizon; uniform vec3 glow; uniform vec3 sun; uniform float sunStrength; varying vec3 vDir;
          void main(){
            vec3 d = normalize(vDir);
            float h = d.y;
            vec3 col = mix(horizon, mid, smoothstep(-0.015, 0.1, h));
            col = mix(col, zenith, smoothstep(0.08, 0.5, h));
            // gentle tonal variation across the sky (no texture, no banding)
            float az = atan(d.z, d.x);
            col *= 1.0 + 0.022 * sin(az * 2.0 + h * 7.0) * (1.0 - smoothstep(0.2, 0.8, h));
            float s = max(dot(d, normalize(sun)), 0.0);
            float band = 1.0 - smoothstep(0.0, 0.3, abs(h - 0.04));
            col = mix(col, glow, clamp(pow(s, 2.4) * band * 0.82 * sunStrength, 0.0, 1.0));
            col += glow * pow(s, 14.0) * 0.38 * sunStrength;
            col += vec3(1.0, 0.96, 0.88) * pow(s, 900.0) * 1.2 * sunStrength;
            col = mix(col, horizon * 0.97, smoothstep(0.0, -0.12, h));
            gl_FragColor = vec4(col, 1.0);
            #include <colorspace_fragment>
          }`,
      }),
    [],
  );
  useEffect(() => {
    scene.fog = new THREE.FogExp2("#efe3d2", 0.0056);
    return () => { scene.fog = null; };
  }, [scene]);
  const skyRef = useRef<THREE.Mesh>(null);
  useFrame(({ camera }) => {
    skyColors(journey.current, state);
    mat.uniforms.zenith.value.copy(state.zenith);
    mat.uniforms.mid.value.copy(state.mid);
    mat.uniforms.horizon.value.copy(state.horizon);
    mat.uniforms.glow.value.copy(state.glow);
    mat.uniforms.sunStrength.value = state.sun;
    mat.uniforms.sun.value.copy(stage.sun);
    if (scene.fog) (scene.fog as THREE.FogExp2).color.copy(fogCol.copy(state.horizon).lerp(state.mid, 0.55).lerp(state.glow, 0.05 * state.sun));
    skyRef.current?.position.copy(camera.position);
  });
  return (
    <mesh ref={skyRef} material={mat} renderOrder={-10} frustumCulled={false}>
      <sphereGeometry args={[900, 48, 24]} />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// Lighting rig for the aircraft: a warm key light that follows the camera (so the fuselage reads
// in every composition), a cool sky fill, and a sun rim light that separates it from the sky.
// ---------------------------------------------------------------------------
export function Lights() {
  const key = useRef<THREE.DirectionalLight>(null);
  const rim = useRef<THREE.DirectionalLight>(null);
  const target = useMemo(() => new THREE.Object3D(), []);
  const v = useMemo(() => ({ right: new THREE.Vector3(), up: new THREE.Vector3(), back: new THREE.Vector3() }), []);
  useFrame(({ camera }) => {
    target.position.copy(stage.plane);
    target.updateMatrixWorld();
    camera.matrixWorld.extractBasis(v.right, v.up, v.back);
    // key: from camera-left, above and in front of the aircraft
    key.current?.position.copy(stage.plane).addScaledVector(v.right, -28).addScaledVector(v.up, 34).addScaledVector(v.back, 30);
    rim.current?.position.copy(stage.plane).addScaledVector(stage.sun, 60);
  });
  return (
    <>
      <primitive object={target} />
      <hemisphereLight args={["#cfe1f4", "#e8d6bd", 1.05]} />
      <directionalLight ref={key} intensity={2.35} color="#fff1df" target={target} />
      <directionalLight ref={rim} intensity={2.1} color="#ffd5a1" target={target} />
      <directionalLight position={[-40, -20, 60]} intensity={0.25} color="#c9d9ea" />
    </>
  );
}

// ---------------------------------------------------------------------------
// Clouds: dimensional billboard cumulus (sunlit crowns, cooler shaded bases), generated once.
// A soft deck sits below the hero so the first viewport reads as sky, not map; further layers
// line the journey, kept clear of the flight corridor.
// ---------------------------------------------------------------------------
function cloudTexture(seed: number) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 256;
  const ctx = c.getContext("2d")!;
  const r = rng(seed);
  const puffs: [number, number, number][] = [];
  for (let i = 0; i < 26; i++) {
    const x = 256 + (r() - 0.5) * 330 * (0.55 + r() * 0.45);
    const rad = 34 + r() * 62 * (1 - Math.abs(x - 256) / 300);
    const y = 168 - rad * (0.35 + r() * 0.45);
    puffs.push([x, y, rad]);
  }
  for (const [x, y, rad] of puffs) {
    const g = ctx.createRadialGradient(x, y - rad * 0.25, rad * 0.1, x, y, rad);
    g.addColorStop(0, "rgba(255,255,255,0.95)");
    g.addColorStop(0.62, "rgba(255,255,255,0.7)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill();
  }
  // shade: warm sunlit crowns, blue-grey bases (source-atop keeps the silhouette)
  ctx.globalCompositeOperation = "source-atop";
  const shade = ctx.createLinearGradient(0, 40, 0, 230);
  shade.addColorStop(0, "rgba(255,246,232,0.35)");
  shade.addColorStop(0.55, "rgba(236,241,247,0.0)");
  shade.addColorStop(1, "rgba(112,138,170,0.7)");
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, c.width, c.height);
  // soft flat base
  ctx.globalCompositeOperation = "destination-out";
  const fade = ctx.createLinearGradient(0, 175, 0, 256);
  fade.addColorStop(0, "rgba(0,0,0,0)");
  fade.addColorStop(1, "rgba(0,0,0,1)");
  ctx.fillStyle = fade;
  ctx.fillRect(0, 175, c.width, 81);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function Clouds({ curve, count }: { curve: THREE.Curve<THREE.Vector3>; count: number }) {
  const texes = useMemo(() => (typeof document !== "undefined" ? [cloudTexture(7), cloudTexture(19), cloudTexture(31)] : null), []);
  const items = useMemo(() => {
    const r = rng(42);
    const out: { pos: THREE.Vector3; w: number; h: number; opacity: number; tex: number }[] = [];
    const tmp = new THREE.Vector3(), tan = new THREE.Vector3();
    // Billboards are wide: anything at flight level must stay well clear of the route (and of the
    // camera, which flies ~25 units beside it) or it washes over the aircraft.
    const route = Array.from({ length: 240 }, (_, i) => curve.getPointAt(i / 239));
    const clearOfRoute = (pos: THREE.Vector3, size: number) => {
      if (pos.y < 7.5) return true; // low deck: passes under the flight path
      let best = Infinity;
      for (const q of route) best = Math.min(best, Math.hypot(pos.x - q.x, pos.z - q.z));
      return best > 58 + size;
    };
    // Real landmark models: keep the monument itself, and the sightline from the stop camera to it,
    // free of cloud billboards (a cloud in front of a textured model reads as a smear).
    const sight = STOPS.flatMap((st, i) => {
      if (!st.model) return [];
      const f = stopFrames()[i];
      const c = cameraKey(st.p);
      const cam = f.plane.clone().addScaledVector(f.side, c.side).addScaledVector(f.head, -c.back);
      const at = landmarkPosition(i);
      return [{ a: new THREE.Vector2(at.x, at.z), b: new THREE.Vector2(cam.x, cam.z) }];
    });
    const clearOfLandmarks = (pos: THREE.Vector3, size: number) => {
      const q = new THREE.Vector2(pos.x, pos.z);
      for (const { a, b } of sight) {
        if (q.distanceTo(a) < 30 + size) return false;
        const ab = b.clone().sub(a);
        const t = Math.min(1, Math.max(0, q.clone().sub(a).dot(ab) / ab.lengthSq()));
        if (q.distanceTo(a.clone().addScaledVector(ab, t)) < 14 + size) return false;
      }
      return true;
    };
    const push = (pos: THREE.Vector3, size: number, opacity: number) => {
      if (!clearOfRoute(pos, size)) return;
      const tex = Math.floor(r() * 3); // drawn before the landmark test so other clouds keep their seeds
      if (!clearOfLandmarks(pos, size)) return;
      out.push({ pos, w: size * 2, h: size, opacity, tex });
    };
    for (let i = 0; i < count; i++) {
      const u = r();
      curve.getPointAt(u, tmp);
      curve.getTangentAt(u, tan);
      const side = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
      const band = r();
      let lateral: number, y: number;
      if (band < 0.5) { lateral = (r() - 0.5) * 180; y = 2 + r() * 6; } // low layer
      else if (band < 0.85) { lateral = (r() < 0.5 ? -1 : 1) * (80 + r() * 90); y = tmp.y - 5 + r() * 9; } // abeam, well clear of the corridor
      else { lateral = (r() - 0.5) * 220; y = 30 + r() * 14; } // high cumulus
      push(tmp.clone().addScaledVector(side, lateral).setY(y).add(new THREE.Vector3((r() - 0.5) * 20, 0, (r() - 0.5) * 20)), 12 + r() * 22, 0.55 + r() * 0.35);
    }
    // hero cloud deck: below and around the departure, kept clear of the aircraft and of the hero
    // camera (a cloud right beside the lens reads as a white smear, not a cloud)
    const p0 = curve.getPointAt(0);
    const t0 = curve.getTangentAt(0);
    const h0 = new THREE.Vector3(t0.x, 0, t0.z).normalize();
    const s0 = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), h0).normalize();
    const heroCam = p0.clone().addScaledVector(s0, 10.2).addScaledVector(h0, 11.6);
    for (let i = 0; i < Math.round(count * 0.7); i++) {
      const a = r() * Math.PI * 2, d = 24 + r() * 130;
      const pos = new THREE.Vector3(p0.x + Math.cos(a) * d, 2.5 + r() * 3.5, p0.z + Math.sin(a) * d);
      const size = 16 + r() * 30;
      if (pos.distanceTo(heroCam) < 34 + size * 0.5) continue;
      push(pos, size, 0.8 + r() * 0.2);
    }
    return out;
  }, [curve, count]);
  if (!texes) return null;
  return (
    <group>
      {items.map((c, i) => (
        <sprite key={i} position={c.pos} scale={[c.w, c.h, 1]} renderOrder={1}>
          <spriteMaterial map={texes[c.tex]} transparent opacity={c.opacity} depthWrite={false} fog />
        </sprite>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Cloud sea: in the first viewport the aircraft flies above a sunlit deck of cloud tops that
// stretches to the horizon (where the engraved monuments rise). It dissolves as the journey
// begins, revealing the engraved atlas below.
// ---------------------------------------------------------------------------
function cloudSeaTexture(size: number) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  const r = rng(77);
  const k = size / 1024;
  // thin base veil so gaps read as depth rather than holes
  const base = ctx.createRadialGradient(size / 2, size / 2, size * 0.1, size / 2, size / 2, size * 0.5);
  base.addColorStop(0, "rgba(190,206,224,0.35)");
  base.addColorStop(1, "rgba(190,206,224,0)");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 620; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * size * 0.47;
    const x = size / 2 + Math.cos(a) * d, y = size / 2 + Math.sin(a) * d;
    const rad = (20 + r() * 70) * k;
    // shaded base (offset down), then sunlit crown
    const g1 = ctx.createRadialGradient(x, y + rad * 0.35, 0, x, y + rad * 0.35, rad * 1.1);
    g1.addColorStop(0, "rgba(104,130,164,0.55)");
    g1.addColorStop(1, "rgba(104,130,164,0)");
    ctx.fillStyle = g1;
    ctx.beginPath(); ctx.arc(x, y + rad * 0.35, rad * 1.1, 0, Math.PI * 2); ctx.fill();
    const g2 = ctx.createRadialGradient(x - rad * 0.2, y - rad * 0.25, 0, x, y, rad);
    g2.addColorStop(0, "rgba(255,250,242,0.95)");
    g2.addColorStop(0.6, "rgba(246,247,250,0.7)");
    g2.addColorStop(1, "rgba(246,247,250,0)");
    ctx.fillStyle = g2;
    ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill();
  }
  // soft circular edge
  ctx.globalCompositeOperation = "destination-in";
  const edge = ctx.createRadialGradient(size / 2, size / 2, size * 0.3, size / 2, size / 2, size * 0.5);
  edge.addColorStop(0, "rgba(0,0,0,1)");
  edge.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export function CloudSea({ curve, lite }: { curve: THREE.Curve<THREE.Vector3>; lite: boolean }) {
  const { tex, center } = useMemo(() => {
    const p0 = curve.getPointAt(0);
    const t0 = curve.getTangentAt(0);
    const head = new THREE.Vector3(t0.x, 0, t0.z).normalize();
    const side = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), head).normalize();
    const cam = p0.clone().addScaledVector(side, 10.2).addScaledVector(head, 11.6);
    const view = new THREE.Vector3(p0.x - cam.x, 0, p0.z - cam.z).normalize();
    return {
      tex: typeof document !== "undefined" ? cloudSeaTexture(lite ? 1024 : 2048) : null,
      center: new THREE.Vector3(cam.x, 2.2, cam.z).addScaledVector(view, 95),
    };
  }, [curve, lite]);
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  const mesh = useRef<THREE.Mesh>(null);
  useEffect(() => () => tex?.dispose(), [tex]);
  useFrame(() => {
    const k = 1 - smoothstep(0.02, 0.075, journey.current); // parts as Delhi (and its India Gate) comes into view
    if (mat.current) mat.current.opacity = k;
    if (mesh.current) mesh.current.visible = k > 0.003;
  });
  if (!tex) return null;
  return (
    <mesh ref={mesh} position={center} rotation-x={-Math.PI / 2} renderOrder={0}>
      <circleGeometry args={[230, 64]} />
      <meshBasicMaterial ref={mat} map={tex} transparent depthWrite={false} fog />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// Atlas ground — an engraved, cartographic plane: graticule, hill hachures, a scale bar,
// a compass rose, and every Indian destination NUAB serves at its true coordinates.
// ---------------------------------------------------------------------------
const GROUND = { x0: -190, x1: 190, z0: -330, z1: 160 }; // world extents covered by the texture

export function atlasTexture(scale: number) {
  const W = Math.round((GROUND.x1 - GROUND.x0) * scale);
  const H = Math.round((GROUND.z1 - GROUND.z0) * scale);
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  const px = (x: number) => (x - GROUND.x0) * scale;
  const pz = (z: number) => (z - GROUND.z0) * scale;
  const mono = getComputedStyle(document.documentElement).getPropertyValue("--font-dm-mono").trim() || "monospace";
  const serif = getComputedStyle(document.documentElement).getPropertyValue("--font-fraunces").trim() || "Georgia";

  // paper
  // antique atlas paper: neighbouring countries in a cooler tone, India in warm ivory.
  // India's outline is its official boundary (Natural Earth, India point of view).
  const indiaPath = () => {
    ctx.beginPath();
    for (const ring of indiaGeo.rings as number[][][]) {
      ring.forEach(([lng, lat], i) => {
        const [x, z] = toWorld(lat, lng);
        if (i) ctx.lineTo(px(x), pz(z)); else ctx.moveTo(px(x), pz(z));
      });
      ctx.closePath();
    }
  };
  ctx.fillStyle = "#e0dbd0";
  ctx.fillRect(0, 0, W, H);
  indiaPath();
  ctx.fillStyle = "#efe7d9";
  ctx.fill();
  const r = rng(11);
  for (let i = 0; i < (W * H) / 900; i++) {
    ctx.fillStyle = `rgba(131,129,119,${0.025 + r() * 0.03})`;
    ctx.fillRect(r() * W, r() * H, 1.2, 1.2);
  }

  // graticule every 0.5°
  const lngMin = GROUND.x0 / ATLAS.K + ATLAS.lng0, lngMax = GROUND.x1 / ATLAS.K + ATLAS.lng0;
  const latMax = -GROUND.z0 / ATLAS.K + ATLAS.lat0, latMin = -GROUND.z1 / ATLAS.K + ATLAS.lat0;
  ctx.lineWidth = Math.max(1, scale * 0.12);
  for (let lng = Math.ceil(lngMin * 2) / 2; lng <= lngMax; lng += 0.5) {
    const [x] = toWorld(0, lng);
    ctx.strokeStyle = Number.isInteger(lng) ? "rgba(131,129,119,0.42)" : "rgba(131,129,119,0.2)";
    ctx.beginPath(); ctx.moveTo(px(x), 0); ctx.lineTo(px(x), H); ctx.stroke();
    if (Number.isInteger(lng)) {
      ctx.fillStyle = "rgba(102,111,121,0.85)";
      ctx.font = `${Math.round(scale * 1.05)}px ${mono}`;
      ctx.textAlign = "left";
      for (let lat = Math.ceil(latMin); lat <= latMax; lat += 1) {
        const [, z] = toWorld(lat + 0.06, lng);
        ctx.fillText(formatCoord(lng, "lng"), px(x) + scale * 0.6, pz(z));
      }
    }
  }
  for (let lat = Math.ceil(latMin * 2) / 2; lat <= latMax; lat += 0.5) {
    const [, z] = toWorld(lat, 0);
    ctx.strokeStyle = Number.isInteger(lat) ? "rgba(131,129,119,0.42)" : "rgba(131,129,119,0.2)";
    ctx.beginPath(); ctx.moveTo(0, pz(z)); ctx.lineTo(W, pz(z)); ctx.stroke();
    if (Number.isInteger(lat)) {
      ctx.fillStyle = "rgba(102,111,121,0.85)";
      ctx.font = `${Math.round(scale * 1.05)}px ${mono}`;
      for (let lng = Math.ceil(lngMin); lng <= lngMax; lng += 1) {
        const [x] = toWorld(0, lng + 0.04);
        ctx.fillText(formatCoord(lat, "lat"), px(x), pz(z) - scale * 0.6);
      }
    }
  }

  // hill hachures for the Himalayan foothills (north of ~30.4°N, east of ~76.2°E) — a
  // cartographic convention indicating rising terrain, not a survey of individual peaks
  ctx.save();
  indiaPath();
  ctx.clip();
  ctx.strokeStyle = "rgba(131,129,119,0.38)";
  ctx.lineWidth = Math.max(1, scale * 0.14);
  for (let i = 0; i < 2600; i++) {
    const lat = 30.35 + r() * (latMax - 30.35);
    const lng = 75.6 + r() * (lngMax - 75.6);
    if (lat < 30.35 + Math.max(0, (77.0 - lng) * 0.55)) continue;
    const [x, z] = toWorld(lat, lng);
    const s = scale * (0.9 + r() * 1.4) * (0.6 + (lat - 30.3) * 0.25);
    ctx.beginPath();
    ctx.moveTo(px(x) - s, pz(z) + s * 0.55);
    ctx.lineTo(px(x), pz(z) - s * 0.35);
    ctx.lineTo(px(x) + s, pz(z) + s * 0.55);
    ctx.stroke();
  }

  ctx.restore();

  // India's boundary: a soft sandstone band with a crisp navy line, engraved-atlas style
  indiaPath();
  ctx.strokeStyle = "rgba(198,167,123,0.45)";
  ctx.lineWidth = scale * 1.4;
  ctx.lineJoin = "round";
  ctx.stroke();
  indiaPath();
  ctx.strokeStyle = "rgba(35,58,80,0.8)";
  ctx.lineWidth = Math.max(1, scale * 0.24);
  ctx.stroke();
  ctx.font = `${Math.round(scale * 1.15)}px ${mono}`;
  ctx.fillStyle = "rgba(102,111,121,0.85)";
  ctx.textAlign = "center";
  const label = (t: string, lat: number, lng: number) => { const [x, z] = toWorld(lat, lng); ctx.fillText(t, px(x), pz(z)); };
  label("PAKISTAN", 31.9, 74.36); // positions verified outside India (point-in-polygon)
  label("TIBET (CHINA)", 32.15, 79.75);
  label("NEPAL", 29.3, 80.45);
  ctx.textAlign = "left";

  // destinations (India only; positions are true coordinates)
  const featured = new Set(STOPS.flatMap((s) => s.destinationIds));
  for (const d of DESTINATION_SEEDS.filter((d) => d.country === "India")) {
    const [x, z] = toWorld(d.lat, d.lng);
    if (x < GROUND.x0 || x > GROUND.x1 || z < GROUND.z0 || z > GROUND.z1) continue;
    const isF = featured.has(d.id);
    ctx.fillStyle = "#233a50";
    ctx.strokeStyle = "#233a50";
    ctx.lineWidth = Math.max(1, scale * 0.16);
    ctx.beginPath(); ctx.arc(px(x), pz(z), scale * (isF ? 0.45 : 0.3), 0, Math.PI * 2); ctx.fill();
    if (isF) { ctx.beginPath(); ctx.arc(px(x), pz(z), scale * 1.1, 0, Math.PI * 2); ctx.stroke(); }
    ctx.fillStyle = isF ? "rgba(35,58,80,0.95)" : "rgba(32,37,43,0.72)";
    ctx.font = `${isF ? 500 : 400} ${Math.round(scale * (isF ? 1.0 : 0.7))}px ${mono}`;
    ctx.textAlign = "left";
    ctx.fillText(d.name.toUpperCase(), px(x) + scale * (isF ? 2.2 : 0.9), pz(z) + scale * 0.4);
  }

  // scale bar: 100 km ≈ 0.9° of latitude
  const kmPerUnit = 111.2 / ATLAS.K;
  const barX = px(-170), barZ = pz(140);
  const bar = (100 / kmPerUnit) * scale;
  ctx.strokeStyle = "#233a50"; ctx.fillStyle = "#233a50";
  ctx.lineWidth = Math.max(1, scale * 0.2);
  ctx.beginPath(); ctx.moveTo(barX, barZ); ctx.lineTo(barX + bar, barZ); ctx.stroke();
  for (let i = 0; i <= 4; i++) { ctx.beginPath(); ctx.moveTo(barX + (bar * i) / 4, barZ - scale * 0.7); ctx.lineTo(barX + (bar * i) / 4, barZ + scale * 0.7); ctx.stroke(); }
  ctx.font = `${Math.round(scale * 1.9)}px ${mono}`;
  ctx.fillText("0", barX - scale * 0.5, barZ - scale * 1.4);
  ctx.fillText("100 KM", barX + bar - scale * 3, barZ - scale * 1.4);

  // compass rose
  const cx = px(150), cz = pz(120), R = scale * 9;
  ctx.lineWidth = Math.max(1, scale * 0.15);
  ctx.beginPath(); ctx.arc(cx, cz, R, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cz, R * 0.72, 0, Math.PI * 2); ctx.stroke();
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * Math.PI * 2, r0 = i % 8 === 0 ? R * 0.72 : R * 0.88;
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r0, cz + Math.sin(a) * r0); ctx.lineTo(cx + Math.cos(a) * R, cz + Math.sin(a) * R); ctx.stroke();
  }
  ctx.beginPath(); ctx.moveTo(cx, cz - R * 1.25); ctx.lineTo(cx + R * 0.14, cz); ctx.lineTo(cx, cz + R * 0.6); ctx.lineTo(cx - R * 0.14, cz); ctx.closePath(); ctx.fill();
  ctx.font = `italic ${Math.round(scale * 3.4)}px ${serif}`;
  ctx.textAlign = "center";
  ctx.fillText("N", cx, cz - R * 1.4);

  // locator inset: the whole of India (official boundary) with this atlas sheet outlined
  {
    const [bx0, by0, bx1, by1] = indiaGeo.bbox as number[];
    const boxX = px(-180), boxZ = pz(28), boxW = 54 * scale, boxH = 72 * scale;
    const k = Math.min((boxW - 6 * scale) / (bx1 - bx0), (boxH - 10 * scale) / (by1 - by0));
    const ox = boxX + (boxW - (bx1 - bx0) * k) / 2, oz = boxZ + 7 * scale;
    const ix = (lng: number) => ox + (lng - bx0) * k, iz = (lat: number) => oz + (by1 - lat) * k;
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.fillRect(boxX, boxZ, boxW, boxH);
    ctx.strokeStyle = "rgba(35,58,80,0.55)";
    ctx.lineWidth = Math.max(1, scale * 0.15);
    ctx.strokeRect(boxX, boxZ, boxW, boxH);
    ctx.beginPath();
    for (const ring of indiaGeo.rings as number[][][]) {
      ring.forEach(([lng, lat], i) => (i ? ctx.lineTo(ix(lng), iz(lat)) : ctx.moveTo(ix(lng), iz(lat))));
      ctx.closePath();
    }
    ctx.fillStyle = "#efe7d9";
    ctx.fill();
    ctx.strokeStyle = "rgba(35,58,80,0.85)";
    ctx.lineWidth = Math.max(1, scale * 0.16);
    ctx.stroke();
    const sLng0 = GROUND.x0 / ATLAS.K + ATLAS.lng0, sLng1 = GROUND.x1 / ATLAS.K + ATLAS.lng0;
    const sLat1 = -GROUND.z0 / ATLAS.K + ATLAS.lat0, sLat0 = -GROUND.z1 / ATLAS.K + ATLAS.lat0;
    ctx.strokeStyle = "#c2603f";
    ctx.lineWidth = Math.max(1.5, scale * 0.3);
    ctx.strokeRect(ix(sLng0), iz(sLat1), (sLng1 - sLng0) * k, (sLat1 - sLat0) * k);
    ctx.font = `${Math.round(scale * 1.25)}px ${mono}`;
    ctx.fillStyle = "rgba(35,58,80,0.9)";
    ctx.fillText("INDIA", boxX + 2 * scale, boxZ + 3.6 * scale);
    ctx.fillStyle = "#c2603f";
    ctx.fillText("THIS SHEET", ix(sLng1) + 1.2 * scale, iz(sLat1) + 1.6 * scale);
  }

  // cartouche
  ctx.textAlign = "left";
  ctx.font = `italic ${Math.round(scale * 4.2)}px ${serif}`;
  ctx.fillStyle = "rgba(35,58,80,0.9)";
  ctx.fillText("Northern India", px(-170), pz(118));
  ctx.font = `${Math.round(scale * 1.7)}px ${mono}`;
  ctx.fillStyle = "rgba(102,111,121,0.9)";
  ctx.fillText("AN ATLAS OF NUAB TOURISM JOURNEYS", px(-170), pz(124));

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

export function AtlasGround({ lite }: { lite: boolean }) {
  const { gl } = useThree();
  const tex = useMemo(() => {
    if (typeof document === "undefined") return null;
    const t = atlasTexture(lite ? 5 : 8);
    t.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
    return t;
  }, [lite, gl]);
  useEffect(() => () => tex?.dispose(), [tex]);
  const w = GROUND.x1 - GROUND.x0, h = GROUND.z1 - GROUND.z0;
  return (
    <group>
      {/* infinite paper beyond the engraved sheet */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.05, 0]}>
        <planeGeometry args={[3000, 3000]} />
        <meshBasicMaterial color="#e8e0d2" />
      </mesh>
      {tex && (
        <mesh rotation-x={-Math.PI / 2} position={[(GROUND.x0 + GROUND.x1) / 2, 0, (GROUND.z0 + GROUND.z1) / 2]}>
          <planeGeometry args={[w, h]} />
          <meshBasicMaterial map={tex} />
        </mesh>
      )}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Himalayan foothill ridges north of Haridwar–Rishikesh (low-poly, fog-softened)
// ---------------------------------------------------------------------------
export function Ridges() {
  const meshes = useMemo(() => {
    const out: { geo: THREE.BufferGeometry; color: string; z: number }[] = [];
    const layers = [
      { z: -150, h: 7, color: "#c9d6e3" },
      { z: -185, h: 13, color: "#bccbdb" },
      { z: -225, h: 22, color: "#b2c3d5" },
      { z: -275, h: 34, color: "#a9bccf" },
    ];
    layers.forEach((L, li) => {
      const r = rng(100 + li);
      const seg = 120;
      const geo = new THREE.PlaneGeometry(420, 1, seg, 1);
      const pos = geo.attributes.position as THREE.BufferAttribute;
      const phase = r() * 10;
      for (let i = 0; i <= seg; i++) {
        const x = -210 + (420 * i) / seg;
        const n = 0.55 * Math.sin(x * 0.045 + phase) + 0.3 * Math.sin(x * 0.11 + phase * 2) + 0.15 * Math.sin(x * 0.29 + phase * 3);
        const top = L.h * (0.75 + 0.45 * n) * (1 + Math.max(0, (x - 0) / 400));
        pos.setXYZ(i, x, top, 0); // top row
        pos.setXYZ(i + seg + 1, x, -2, 0); // bottom row
      }
      geo.computeVertexNormals();
      out.push({ geo, color: L.color, z: L.z });
    });
    return out;
  }, []);
  return (
    <group position={[40, 0, 0]}>
      {meshes.map((m, i) => (
        <mesh key={i} geometry={m.geo} position={[0, 0, m.z]}>
          <meshBasicMaterial color={m.color} fog side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}
