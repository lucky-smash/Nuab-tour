"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { journey, skyColors, rng, smoothstep, stage, stopFrames, cameraKey, landmarkPosition, getCurve, type SkyState } from "./journeyMath";
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
    // no clouds in the hero composition: the first viewport is a clear dawn sky
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
// Himalaya north of Haridwar–Rishikesh: a low-poly heightfield of ridged noise rising from sage
// foothills to snow-capped slate peaks, flat-shaded and lit like the monuments, softened by the fog.
// Under the flight route the terrain is held below the aircraft (and the chase camera behind it).
// ---------------------------------------------------------------------------
const MOUNTAINS = { x0: -260, x1: 420, z0: -128, z1: -430, cell: 6 };

function valueNoise(x: number, z: number) {
  const h = (i: number, j: number) => { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s); };
  const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  return (h(i, j) * (1 - u) + h(i + 1, j) * u) * (1 - v) + (h(i, j + 1) * (1 - u) + h(i + 1, j + 1) * u) * v;
}
/** ridged fBm in 0..1: sharp crests, soft valleys */
function ridged(x: number, z: number) {
  let sum = 0, amp = 0.55, f = 1, norm = 0;
  for (let o = 0; o < 4; o++) {
    const r = 1 - Math.abs(2 * valueNoise(x * f + o * 17.3, z * f - o * 9.1) - 1);
    sum += amp * r * r;
    norm += amp;
    amp *= 0.5;
    f *= 2.07;
  }
  return sum / norm;
}

export function Ridges() {
  const geo = useMemo(() => {
    const M = MOUNTAINS;
    const r = rng(311);
    // route samples over the north leg: horizontal position and altitude
    const curve = getCurve();
    const route: THREE.Vector3[] = [];
    for (let i = 0; i <= 240; i++) {
      const q = curve.getPointAt(i / 240);
      if (q.z < M.z0 + 40) route.push(q);
    }
    const nx = Math.round((M.x1 - M.x0) / M.cell), nz = Math.round((M.z0 - M.z1) / M.cell);
    const heightAt = (x: number, z: number) => {
      const north = Math.min(1, Math.max(0, (M.z0 - 8 - z) / 250));
      const amp = 3 + 78 * Math.pow(north, 1.5);
      let h = amp * (0.25 + 0.75 * ridged(x * 0.013, z * 0.013)) - 2.5 * (1 - north);
      h *= smoothstep(M.z0, M.z0 - 22, z); // meet the atlas along the southern edge
      // clear of the aircraft: below its altitude near the route, freely above it 75 units out
      let best = Infinity, alt = 0;
      for (const q of route) {
        const d = (q.x - x) ** 2 + (q.z - z) ** 2;
        if (d < best) { best = d; alt = q.y; }
      }
      const cap = alt - 7;
      if (h > cap) h = cap + (h - cap) * smoothstep(28, 75, Math.sqrt(best));
      return h;
    };
    // jittered grid -> low-poly facets
    const P: THREE.Vector3[] = [];
    for (let j = 0; j <= nz; j++)
      for (let i = 0; i <= nx; i++) {
        const edge = i === 0 || j === 0 || i === nx || j === nz;
        const x = M.x0 + i * M.cell + (edge ? 0 : (r() - 0.5) * M.cell * 0.7);
        const z = M.z0 - j * M.cell + (edge ? 0 : (r() - 0.5) * M.cell * 0.7);
        P.push(new THREE.Vector3(x, heightAt(x, z), z));
      }
    const pos: number[] = [], col: number[] = [];
    const c = new THREE.Color();
    const SAGE = new THREE.Color("#9cab95"), SLATE = new THREE.Color("#7a8796"), DARK = new THREE.Color("#5c6776"), SNOW = new THREE.Color("#f6f8fa");
    const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), n = new THREE.Vector3();
    const face = (a: THREE.Vector3, b: THREE.Vector3, d: THREE.Vector3) => {
      const top = Math.max(a.y, b.y, d.y);
      if (top < 0.05) return; // flat at/below the atlas: leave the map visible
      n.crossVectors(e1.subVectors(b, a), e2.subVectors(d, a)).normalize();
      if (n.y < 0) { const t = b; b = d; d = t; n.negate(); }
      const y = (a.y + b.y + d.y) / 3;
      const steep = 1 - n.y; // 0 flat .. 1 vertical
      c.copy(SAGE).lerp(SLATE, smoothstep(6, 26, y)).lerp(DARK, smoothstep(0.25, 0.6, steep) * smoothstep(10, 30, y));
      const snowline = 47 + 10 * valueNoise(a.x * 0.05, a.z * 0.05) + 30 * steep;
      c.lerp(SNOW, smoothstep(snowline - 3, snowline + 3, y));
      for (const v of [a, b, d]) { pos.push(v.x, v.y, v.z); col.push(c.r, c.g, c.b); }
    };
    const at = (i: number, j: number) => P[j * (nx + 1) + i];
    for (let j = 0; j < nz; j++)
      for (let i = 0; i < nx; i++) {
        face(at(i, j), at(i + 1, j), at(i + 1, j + 1));
        face(at(i, j), at(i + 1, j + 1), at(i, j + 1));
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals(); // non-indexed: one normal per facet
    return g;
  }, []);
  return (
    <mesh geometry={geo} name="himalaya">
      <meshStandardMaterial vertexColors flatShading roughness={0.95} metalness={0} envMapIntensity={0.4} fog />
    </mesh>
  );
}
