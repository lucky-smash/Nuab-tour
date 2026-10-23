"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { DecalGeometry } from "three/examples/jsm/geometries/DecalGeometry.js";

export const AIRCRAFT_URL = "/models/nuab-aircraft.glb";

/**
 * The client's own airliner (converted from assets/source/3d-model.3ds by scripts/convert-3ds.mjs).
 * Local frame: +Z = nose, +Y = up, length 10 units, centred on the fuselage.
 *
 * Branding: "NUAB TOURISM" titles and a navy cheatline are *projected decals* (DecalGeometry)
 * conforming to the fuselage surface on both sides. The source model has no usable UV layout
 * for a livery texture, so decals are the faithful option; the geometry itself is untouched.
 */
export function Aircraft({ gearDown, onReady }: { gearDown: React.RefObject<boolean>; onReady?: () => void }) {
  const { scene } = useGLTF(AIRCRAFT_URL);
  const root = useMemo(() => scene, [scene]);
  const fans = useRef<THREE.Object3D[]>([]);
  const gear = useRef<THREE.Object3D | null>(null);

  useEffect(() => {
    fans.current = ["fan_left", "fan_right"].map((n) => root.getObjectByName(n)).filter(Boolean) as THREE.Object3D[];
    gear.current = root.getObjectByName("gear") ?? null;
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.frustumCulled = false;
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        mats.forEach((mat) => {
          const sm = mat as THREE.MeshStandardMaterial;
          // Presentation tuning (runtime only; the GLB is unchanged): a satin off-white paint that
          // keeps panel detail against a bright sky, livelier metals, crisp glass.
          if (sm.name === "paint_white") { sm.color.set("#e9edf1"); sm.roughness = 0.36; sm.metalness = 0.06; sm.envMapIntensity = 0.85; }
          else if (sm.name === "paint_grey") { sm.color.set("#c7cdd4"); sm.envMapIntensity = 1.0; }
          else if (sm.name === "livery_navy") { sm.color.set("#203a55"); sm.roughness = 0.3; sm.envMapIntensity = 1.0; }
          else if (sm.name.startsWith("metal") || sm.name === "titanium") sm.envMapIntensity = 1.2;
          else if (sm.name.startsWith("glass")) { sm.roughness = 0.05; sm.envMapIntensity = 1.4; }
          else sm.envMapIntensity = 0.9;
        });
      }
    });
    const fuselageObj = root.getObjectByName("fuselage");
    const fuselage = (fuselageObj as THREE.Mesh)?.isMesh ? (fuselageObj as THREE.Mesh) : (fuselageObj?.children.find((c) => (c as THREE.Mesh).isMesh) as THREE.Mesh | undefined);
    let cleanup = () => {};
    if (fuselage && !fuselage.userData.decorated) {
      fuselage.userData.decorated = true;
      cleanup = applyLivery(fuselage);
    }
    onReady?.();
    return cleanup;
  }, [root, onReady]);

  useFrame((_, dt) => {
    for (const f of fans.current) f.rotation.z += dt * 6;
    if (gear.current) {
      const target = gearDown.current ? 1 : 0;
      const s = gear.current.scale.y + (target - gear.current.scale.y) * Math.min(1, dt * 3);
      gear.current.scale.set(1, Math.max(0.001, s), 1);
      gear.current.visible = s > 0.02;
    }
  });

  return <primitive object={root} />;
}

useGLTF.preload(AIRCRAFT_URL);

// ---------------------------------------------------------------------------
// Livery decals
// ---------------------------------------------------------------------------
function fontFamily(varName: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return v ? `${v}, ${fallback}` : fallback;
}

function makeTitleTexture() {
  const c = document.createElement("canvas");
  c.width = 2048;
  c.height = 256;
  const ctx = c.getContext("2d")!;
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.fillStyle = "#233A50";
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  ctx.font = `700 178px ${fontFamily("--font-fraunces", "Georgia, serif")}`;
  // manual tracking for broad canvas support
  const text = "NUAB  TOURISM";
  const tracking = 22;
  const widths = [...text].map((ch) => ctx.measureText(ch).width + tracking);
  const total = widths.reduce((a, b) => a + b, 0) - tracking;
  let x = (c.width - total) / 2;
  ctx.textAlign = "left";
  [...text].forEach((ch, i) => { ctx.fillText(ch, x, c.height / 2 + 6); x += widths[i]; });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return { texture: t, aspect: total / 150 };
}

function makeStripeTexture() {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 32;
  const ctx = c.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, c.width, 0);
  g.addColorStop(0, "rgba(35,58,80,0)");
  g.addColorStop(0.08, "rgba(35,58,80,1)");
  g.addColorStop(0.92, "rgba(35,58,80,1)");
  g.addColorStop(1, "rgba(35,58,80,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 8, c.width, 12);
  ctx.fillStyle = "rgba(131,129,119,0.9)";
  ctx.fillRect(0, 23, c.width, 3);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function applyLivery(fuselage: THREE.Mesh) {
  // Project in *model* space (the aircraft root frame), independent of the aircraft's current
  // pose. The GLB is quantized (KHR_mesh_quantization), so the fuselage mesh carries a
  // dequantizing scale/offset that must be applied before measuring or projecting.
  fuselage.updateMatrix();
  const local = new THREE.Mesh(fuselage.geometry);
  local.matrixAutoUpdate = false;
  local.matrix.copy(fuselage.matrix);
  local.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(local);
  const cy = (bb.min.y + bb.max.y) / 2;
  const r = (bb.max.x - bb.min.x) / 2;
  const raycaster = new THREE.Raycaster();
  const added: THREE.Mesh[] = [];
  const disposables: { dispose(): void }[] = [];

  // fuselage cross-section at station z (centre height + radius), measured by vertical rays —
  // robust to the tail-cone upsweep that skews the overall bounding box
  const section = (z: number) => {
    raycaster.set(new THREE.Vector3(0, bb.max.y + 5, z), new THREE.Vector3(0, -1, 0));
    const top = raycaster.intersectObject(local, false)[0]?.point.y;
    raycaster.set(new THREE.Vector3(0, bb.min.y - 5, z), new THREE.Vector3(0, 1, 0));
    const bottom = raycaster.intersectObject(local, false)[0]?.point.y;
    if (top == null || bottom == null) return { cy, r };
    return { cy: (top + bottom) / 2, r: (top - bottom) / 2 };
  };
  const surface = (side: 1 | -1, y: number, z: number) => {
    raycaster.set(new THREE.Vector3(side * (r * 4), y, z), new THREE.Vector3(-side, 0, 0));
    const hit = raycaster.intersectObject(local, false)[0];
    return hit?.point ?? null;
  };

  const orient = (side: 1 | -1) => {
    // projector z = outward side normal; projector x runs along the fuselage so titles read
    // left-to-right on both sides
    const n = new THREE.Vector3(side, 0, 0);
    const up = new THREE.Vector3(0, 1, 0);
    const x = new THREE.Vector3().crossVectors(up, n).normalize();
    const y = new THREE.Vector3().crossVectors(n, x).normalize();
    return new THREE.Euler().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, n));
  };

  const title = makeTitleTexture();
  const stripe = makeStripeTexture();
  disposables.push(title.texture, stripe);
  const mat = (map: THREE.Texture) =>
    new THREE.MeshStandardMaterial({ map, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, roughness: 0.35, metalness: 0.1 });
  const titleMat = mat(title.texture);
  const stripeMat = mat(stripe);
  disposables.push(titleMat, stripeMat);

  const TITLE_Z = 1.25;
  const STRIPE_Z = 0.4;
  const ts = section(TITLE_Z);
  const ss = section(STRIPE_Z);
  const titleH = ts.r * 0.36;
  for (const side of [1, -1] as const) {
    const titlePos = surface(side, ts.cy + ts.r * 0.77, TITLE_Z); // band above the window line
    if (titlePos) {
      const g = new DecalGeometry(local, titlePos, orient(side), new THREE.Vector3(titleH * title.aspect, titleH, ts.r * 1.4));
      const m = new THREE.Mesh(g, titleMat);
      added.push(m);
    }
    const stripePos = surface(side, ss.cy - ss.r * 0.12, STRIPE_Z);
    if (stripePos) {
      const g = new DecalGeometry(local, stripePos, orient(side), new THREE.Vector3(6.4, ss.r * 0.14, ss.r * 1.2));
      added.push(new THREE.Mesh(g, stripeMat));
    }
  }
  const parent = fuselage.parent ?? fuselage;
  for (const m of added) {
    m.renderOrder = 2;
    m.name = "livery-decal";
    parent.add(m);
    disposables.push(m.geometry);
  }
  return () => {
    added.forEach((m) => parent.remove(m));
    disposables.forEach((d) => d.dispose());
    fuselage.userData.decorated = false;
  };
}
