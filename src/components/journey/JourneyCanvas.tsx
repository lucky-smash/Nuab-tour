"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import { Aircraft } from "./Aircraft";
import { AtlasGround, CloudSea, Clouds, Lights, Ridges, Sky } from "./Environment";
import { Engravings, HeroSkyline, RouteLines, StopMarkers } from "./Landmarks";
import { cameraKey, getCurve, journey, progressToU, lerp, stopFrames, stage } from "./journeyMath";
import { STOPS } from "./config";

/**
 * The WebGL stage. All motion is a pure function of journey.current (damped scroll progress),
 * so the scene reverses exactly when the visitor scrolls back up and never plays on its own.
 */
export default function JourneyCanvas({ active, lite, onAircraftReady }: { active: boolean; lite: boolean; onAircraftReady?: () => void }) {
  return (
    <Canvas
      frameloop={active ? "always" : "never"}
      dpr={lite ? [1, 1.25] : [1, 1.75]}
      gl={{ antialias: true, powerPreference: "high-performance", alpha: false, stencil: false }}
      camera={{ fov: 36, near: 0.3, far: 2000, position: [10, 15, -40] }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 0.98;
      }}
      aria-hidden
    >
      <Scene lite={lite} onAircraftReady={onAircraftReady} />
    </Canvas>
  );
}

function Scene({ lite, onAircraftReady }: { lite: boolean; onAircraftReady?: () => void }) {
  const curve = useMemo(() => getCurve(), []);
  return (
    <>
      <Sky />
      <Lights />
      {/* reflection environment: soft sky above, warm horizon band, cool ground bounce */}
      <Environment resolution={lite ? 64 : 128} frames={1}>
        <Lightformer form="rect" intensity={1.6} color="#dbe9f7" position={[0, 9, 0]} rotation-x={Math.PI / 2} scale={[24, 24, 1]} />
        <Lightformer form="rect" intensity={1.4} color="#ffe2bd" position={[0, 1, -10]} scale={[30, 3, 1]} />
        <Lightformer form="rect" intensity={0.9} color="#a8c9e8" position={[-10, 2, 4]} rotation-y={Math.PI / 2} scale={[16, 5, 1]} />
        <Lightformer form="rect" intensity={0.35} color="#c9bfae" position={[0, -6, 0]} rotation-x={-Math.PI / 2} scale={[24, 24, 1]} />
      </Environment>
      <AtlasGround lite={lite} />
      <Ridges />
      <CloudSea curve={curve} lite={lite} />
      <Clouds curve={curve} count={lite ? 26 : 54} />
      <RouteLines curve={curve} />
      <StopMarkers />
      <Engravings />
      <HeroSkyline curve={curve} />
      <FlightRig curve={curve} onAircraftReady={onAircraftReady} />
    </>
  );
}

const UP = new THREE.Vector3(0, 1, 0);

function FlightRig({ curve, onAircraftReady }: { curve: THREE.CatmullRomCurve3; onAircraftReady?: () => void }) {
  const plane = useRef<THREE.Group>(null);
  const banked = useRef<THREE.Group>(null);
  const gearDown = useRef(true);
  const { camera, size, scene } = useThree();
  const tmp = useMemo(
    () => ({ pos: new THREE.Vector3(), tan: new THREE.Vector3(), tan2: new THREE.Vector3(), head: new THREE.Vector3(), side: new THREE.Vector3(), camPos: new THREE.Vector3(), look: new THREE.Vector3(), smoothHead: new THREE.Vector3(0, 0, 1), camTarget: new THREE.Vector3(), lookTarget: new THREE.Vector3() }),
    [],
  );
  const bank = useRef(0);
  const first = useRef(true);
  const introStart = useRef<number | null>(null);
  const reduced = useMemo(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);

  useMemo(() => stopFrames(), []);

  // dev / QA hook: window.__nuabJourney
  useEffect(() => {
    const w = window as unknown as { __nuabJourney?: object };
    w.__nuabJourney = {
      get progress() { return journey.current; },
      get target() { return journey.target; },
      aircraft: () => { const p = plane.current; return p ? { position: p.position.toArray().map((n) => +n.toFixed(2)), quaternion: p.quaternion.toArray().map((n) => +n.toFixed(3)), visible: p.visible } : null; },
      camera: () => camera.position.toArray().map((n) => +n.toFixed(2)),
      set snap(v: boolean) { journey.snap = v; },
      scene,
      get intro() { return stage.intro; },
      project: () => stopFrames().map((f, i) => {
        const c = f.engraving.clone().setY(12);
        const v = c.clone().project(camera);
        return { stop: STOPS[i].id, ndc: [+v.x.toFixed(2), +v.y.toFixed(2)], dist: +camera.position.distanceTo(c).toFixed(1) };
      }),
    };
    return () => { delete w.__nuabJourney; };
  }, [camera, scene]);

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 1 / 20);
    // damp progress towards the scroll target (critically damped feel, no overshoot)
    const snap = first.current || journey.snap;
    const k = 1 - Math.exp(-dt * 5.5);
    journey.current += (journey.target - journey.current) * (snap ? 1 : k);
    if (Math.abs(journey.target - journey.current) < 1e-5) journey.current = journey.target;
    const p = journey.current;
    const u = progressToU(p);

    curve.getPointAt(u, tmp.pos);
    curve.getTangentAt(u, tmp.tan);
    curve.getTangentAt(Math.min(1, u + 0.004), tmp.tan2);

    // bank from heading change (signed yaw rate), clamped and damped
    const yaw0 = Math.atan2(tmp.tan.x, tmp.tan.z), yaw1 = Math.atan2(tmp.tan2.x, tmp.tan2.z);
    let dy = yaw1 - yaw0;
    if (dy > Math.PI) dy -= Math.PI * 2;
    if (dy < -Math.PI) dy += Math.PI * 2;
    const targetBank = THREE.MathUtils.clamp(-dy * 9, -0.32, 0.32);
    bank.current += (targetBank - bank.current) * (snap ? 1 : 1 - Math.exp(-dt * 3));

    // Entrance: once the model is on stage the aircraft glides ~24 units into its hero position
    // (≈1.8 s). Scrolling during the entrance completes it immediately. Camera stays composed on
    // the final position so the aircraft flies into the frame.
    if (introStart.current == null && plane.current?.children[0]?.children.length) introStart.current = performance.now();
    const t = introStart.current == null ? 0 : (performance.now() - introStart.current) / 1800;
    const introDone = reduced || journey.snap || journey.target > 0.015 || t >= 1;
    stage.intro = introDone ? Math.min(1, stage.intro + dt * 3) : 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
    const lag = (1 - stage.intro);
    if (plane.current && banked.current) {
      plane.current.position.copy(tmp.pos).addScaledVector(tmp.tan, -24 * lag).addScaledVector(UP, -1.6 * lag);
      plane.current.lookAt(tmp.look.copy(plane.current.position).add(tmp.tan));
      banked.current.rotation.z = bank.current + 0.12 * lag;
      stage.plane.copy(plane.current.position);
    }
    gearDown.current = false; // cruising above the cloud deck from the first frame

    // --- camera: composed in the aircraft's (smoothed) horizontal heading frame
    tmp.head.set(tmp.tan.x, 0, tmp.tan.z).normalize();
    tmp.smoothHead.lerp(tmp.head, snap ? 1 : 1 - Math.exp(-dt * 2.2)).normalize();
    tmp.side.crossVectors(UP, tmp.smoothHead).normalize(); // + = aircraft's left
    const c = cameraKey(p);
    const portrait = size.width < size.height * 0.85;
    const dist = portrait ? 1.45 : size.width < 1100 ? 1.15 : 1;
    tmp.camTarget
      .copy(tmp.pos)
      .addScaledVector(tmp.side, c.side * dist)
      .addScaledVector(UP, c.up * (portrait ? 1.25 : 1))
      .addScaledVector(tmp.smoothHead, -c.back * dist);
    tmp.lookTarget.copy(tmp.pos).addScaledVector(tmp.smoothHead, c.look).addScaledVector(UP, c.lookUp);
    if (snap) { camera.position.copy(tmp.camTarget); tmp.camPos.copy(tmp.lookTarget); }
    else {
      camera.position.lerp(tmp.camTarget, 1 - Math.exp(-dt * 4));
      tmp.camPos.lerp(tmp.lookTarget, 1 - Math.exp(-dt * 4));
    }
    camera.lookAt(tmp.camPos);
    // the sunrise sits behind the aircraft in the hero view (chosen once, then fixed in the world)
    if (!stage.sunReady && p < 0.01) {
      const f = new THREE.Vector3().subVectors(tmp.pos, camera.position).setY(0).normalize();
      const right = new THREE.Vector3().crossVectors(f, UP).normalize();
      stage.sun.copy(f).addScaledVector(right, 0.95).addScaledVector(UP, 0.14).normalize();
      stage.sunReady = true;
    }
    const cam = camera as THREE.PerspectiveCamera;
    const fov = portrait ? c.fov * 1.25 : c.fov;
    if (Math.abs(cam.fov - fov) > 0.01) cam.fov = lerp(cam.fov, fov, snap ? 1 : 1 - Math.exp(-dt * 3));
    // horizontal framing: shift the projection so the aircraft sits beside the text column
    const frame = portrait ? 0 : c.frame;
    const vshift = portrait ? 0.34 : 0; // portrait: aircraft in the upper third, text sheet below
    cam.setViewOffset(size.width, size.height, -frame * size.width * 0.5, vshift * size.height, size.width, size.height);
    cam.updateProjectionMatrix();
    first.current = false;
  });

  return (
    <group ref={plane}>
      <group ref={banked}>
        <Suspense fallback={null}>
          <Aircraft gearDown={gearDown} onReady={onAircraftReady} />
        </Suspense>
      </group>
    </group>
  );
}
