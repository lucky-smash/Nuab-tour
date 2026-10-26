"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { journey, progressToU, rng, smoothstep } from "./journeyMath";
import { STOPS } from "./config";

// ---------------------------------------------------------------------------
// Cloud banks: a few smoky, hazy banks that sit right on the flight line between monuments, so the
// aircraft flies into them and out the other side. Only on the legs listed here; each is placed at a
// progress value midway between two stops, where the camera is in its chase pose and no monument or
// stop card is on screen. As the camera enters a bank the scene fog thickens and a drifting smoke
// veil covers the view; both are pure functions of the camera position, so they reverse on scroll.
// ---------------------------------------------------------------------------
const BANKS = [
  { p: 0.356, half: 24, radius: 18, seed: 11 }, // Agra → Jaipur
  { p: 0.728, half: 24, radius: 18, seed: 23 }, // Mathura–Vrindavan → Haridwar–Rishikesh
];
const HAZE_FOG = 0.016; // extra FogExp2 density at the heart of a bank
const SMOKE = new THREE.Color("#dcd8d1"); // warm smoggy grey
const SMOKE_SHADE = new THREE.Color("#a7abb1");

function smokeTexture(seed: number) {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const ctx = c.getContext("2d")!;
  const r = rng(seed);
  // many small, faint puffs in a lumpy, stretched cluster: reads as smoke rather than a cumulus
  for (let i = 0; i < 70; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 82;
    const x = 128 + Math.cos(a) * d * 1.15, y = 132 + Math.sin(a) * d * 0.7;
    const rad = 16 + r() * 34;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, `rgba(255,255,255,${0.16 + r() * 0.18})`);
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill();
  }
  // cooler, denser underside
  ctx.globalCompositeOperation = "source-atop";
  const shade = ctx.createLinearGradient(0, 60, 0, 220);
  shade.addColorStop(0, "rgba(255,250,242,0.2)");
  shade.addColorStop(1, "rgba(120,128,140,0.45)");
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, 256, 256);
  // soft round edge so no billboard corner ever shows
  ctx.globalCompositeOperation = "destination-in";
  const edge = ctx.createRadialGradient(128, 128, 40, 128, 128, 128);
  edge.addColorStop(0, "rgba(0,0,0,1)");
  edge.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

type Puff = { pos: THREE.Vector3; w: number; h: number; opacity: number; tex: number; rot: number; spin: number; tint: THREE.Color };

export function CloudBanks({ curve, lite }: { curve: THREE.Curve<THREE.Vector3>; lite: boolean }) {
  const { scene } = useThree();
  const texes = useMemo(() => (typeof document !== "undefined" ? [smokeTexture(5), smokeTexture(17), smokeTexture(29)] : null), []);
  useEffect(() => () => texes?.forEach((t) => t.dispose()), [texes]);

  const { puffs, cores } = useMemo(() => {
    const len = curve.getLength();
    const puffs: Puff[] = [];
    const cores: { pts: THREE.Vector3[]; radius: number }[] = [];
    const pos = new THREE.Vector3(), tan = new THREE.Vector3();
    for (const b of BANKS) {
      const r = rng(b.seed);
      const uc = progressToU(b.p), du = b.half / len;
      cores.push({ pts: Array.from({ length: 25 }, (_, i) => curve.getPointAt(THREE.MathUtils.clamp(uc - du + (2 * du * i) / 24, 0, 1))), radius: b.radius });
      const n = lite ? 20 : 32;
      for (let i = 0; i < n; i++) {
        // denser toward the middle of the bank, around and just above the flight line (the chase
        // camera rides ~8 units above the aircraft, so it passes through the smoke too)
        const s = (r() + r() - 1) * du;
        curve.getPointAt(THREE.MathUtils.clamp(uc + s, 0, 1), pos);
        curve.getTangentAt(THREE.MathUtils.clamp(uc + s, 0, 1), tan);
        const side = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
        const lateral = (r() + r() - 1) * b.radius * 1.3;
        const y = pos.y - 3 + r() * 13;
        const size = 14 + r() * 24;
        puffs.push({
          pos: pos.clone().addScaledVector(side, lateral).setY(y),
          w: size * 1.7,
          h: size,
          opacity: 0.24 + r() * 0.26,
          tex: Math.floor(r() * 3),
          rot: r() * Math.PI * 2,
          spin: (r() - 0.5) * 2.4,
          tint: SMOKE.clone().lerp(SMOKE_SHADE, r() * 0.45),
        });
      }
    }
    return { puffs, cores };
  }, [curve, lite]);

  const sprites = useRef<(THREE.Sprite | null)[]>([]);
  const veil = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthTest: false,
        depthWrite: false,
        fog: false,
        uniforms: { amount: { value: 0 }, drift: { value: 0 }, aspect: { value: 1 }, color: { value: SMOKE.clone() }, shade: { value: SMOKE_SHADE.clone() } },
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
        fragmentShader: `uniform float amount; uniform float drift; uniform float aspect; uniform vec3 color; uniform vec3 shade; varying vec2 vUv;
          float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
          float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
            return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
          float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ v += a * noise(p); p = p * 2.03 + 17.0; a *= 0.5; } return v; }
          void main(){
            vec2 p = vec2((vUv.x - 0.5) * aspect, vUv.y - 0.5) * 2.6;
            float n = fbm(p + vec2(drift, drift * 0.3));
            float m = fbm(p * 1.7 + vec2(-drift * 0.6, 0.0) + n * 1.4);
            float wisp = smoothstep(0.3, 0.8, n * 0.55 + m * 0.55);
            float edge = smoothstep(0.15, 0.75, length(vUv - 0.5));
            float a = amount * mix(0.35, 1.0, wisp) * mix(0.8, 1.0, edge);
            gl_FragColor = vec4(mix(shade, color, wisp), clamp(a, 0.0, 0.9));
            #include <colorspace_fragment>
          }`,
      }),
    [],
  );
  useEffect(() => () => veil.dispose(), [veil]);
  const veilMesh = useRef<THREE.Mesh>(null);
  const base = useRef<{ fog: THREE.Fog | THREE.FogExp2 | null; density: number }>({ fog: null, density: 0 });
  const fogTint = useMemo(() => new THREE.Color(), []);

  useFrame(({ camera, size }) => {
    // how deep the camera is inside the nearest bank (0 outside, 1 at its heart)
    let haze = 0;
    for (const c of cores) {
      let d = Infinity;
      for (const q of c.pts) d = Math.min(d, camera.position.distanceTo(q));
      haze = Math.max(haze, 1 - smoothstep(c.radius * 0.25, c.radius * 1.1, d));
    }
    // never over a stop: the haze is gone before a monument or its card comes on screen
    const fromStop = Math.min(...STOPS.map((st) => Math.abs(journey.current - st.p)));
    haze *= smoothstep(0.045, 0.075, fromStop);
    // puffs right at the lens read as flat smears: fade them as the camera reaches them
    puffs.forEach((pf, i) => {
      const s = sprites.current[i];
      if (!s) return;
      const near = smoothstep(7, 20, camera.position.distanceTo(pf.pos));
      const m = s.material as THREE.SpriteMaterial;
      m.opacity = pf.opacity * near;
      m.rotation = pf.rot + journey.current * pf.spin;
      s.visible = near > 0.01;
    });
    // thicker, greyer fog inside a bank: the atlas and far monuments vanish into the smog
    const fog = scene.fog as THREE.FogExp2 | null;
    if (fog && "density" in fog) {
      if (base.current.fog !== fog) base.current = { fog, density: fog.density };
      fog.density = base.current.density + HAZE_FOG * haze;
      if (haze > 0) fog.color.lerp(fogTint.copy(SMOKE), haze * 0.85);
    }
    veil.uniforms.amount.value = smoothstep(0.15, 1, haze) * 0.5;
    veil.uniforms.drift.value = journey.current * 60;
    veil.uniforms.aspect.value = size.width / Math.max(1, size.height);
    if (veilMesh.current) veilMesh.current.visible = veil.uniforms.amount.value > 0.002;
  });

  if (!texes) return null;
  return (
    <group>
      {puffs.map((pf, i) => (
        <sprite key={i} ref={(s) => { sprites.current[i] = s; }} position={pf.pos} scale={[pf.w, pf.h, 1]} renderOrder={2}>
          <spriteMaterial map={texes[pf.tex]} color={pf.tint} transparent opacity={pf.opacity} depthWrite={false} fog />
        </sprite>
      ))}
      <mesh ref={veilMesh} material={veil} renderOrder={1000} frustumCulled={false} visible={false}>
        <planeGeometry args={[2, 2]} />
      </mesh>
    </group>
  );
}
