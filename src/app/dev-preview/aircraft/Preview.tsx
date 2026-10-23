"use client";

import { Suspense, useRef } from "react";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import { Aircraft } from "@/components/journey/Aircraft";

/** Dev-only: renders the branded aircraft on a transparent background (used to produce the static fallback image). */
export default function Preview() {
  const gear = useRef(false);
  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <Canvas
        gl={{ alpha: true, antialias: true, preserveDrawingBuffer: true }}
        camera={{ fov: 30, position: [-13.5, 3.2, 12.5] }}
        onCreated={({ gl, camera }) => {
          gl.setClearColor(0x000000, 0);
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          camera.lookAt(0, 0.1, 0.4);
        }}
      >
        <hemisphereLight args={["#f4f8fc", "#b9c4cf", 1.1]} />
        <directionalLight position={[60, 90, -40]} intensity={2.4} color="#fffaf2" />
        <directionalLight position={[-40, 20, 60]} intensity={0.6} color="#dfe9f5" />
        <Environment resolution={128} frames={1}>
          <Lightformer form="rect" intensity={2.2} position={[0, 8, -6]} scale={[14, 3, 1]} />
          <Lightformer form="rect" intensity={1.2} color="#dee8f4" position={[-8, 2, 6]} rotation-y={Math.PI / 2} scale={[12, 4, 1]} />
        </Environment>
        <group rotation={[0.04, 0, -0.1]}>
          <Suspense fallback={null}>
            <Aircraft gearDown={gear} onReady={() => { document.title = "ready"; }} />
          </Suspense>
        </group>
      </Canvas>
    </div>
  );
}
