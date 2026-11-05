/**
 * Shared, mutable journey state. Written by the ScrollTrigger (DOM side) and read inside
 * useFrame (WebGL side) — no React state, so scrolling never re-renders the React tree.
 *
 * Kept free of three.js so the page bundle (Journey.tsx) doesn't pull in the 3D engine: three.js
 * loads only with the WebGL stage, and never for visitors who get the still journey.
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
