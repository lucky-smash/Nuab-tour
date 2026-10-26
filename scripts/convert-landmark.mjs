// Landmark model pipeline: OBJ (optionally with one baked texture atlas) -> compact GLB for the journey.
//
//   node scripts/convert-landmark.mjs <model.obj> <texture.png> <out.glb> [maxTextureSize]      (textured)
//   node scripts/convert-landmark.mjs <model.obj> <out.glb> [options]                            (any)
//
// Options:
//   --texture <file>     texture atlas (UVs required). Converted to WebP; alpha cut-outs kept (MASK).
//   --max-texture <px>   longest texture side (default 2048)
//   --color <hex>        base colour when there is no texture (default #e8ddca, warm white marble)
//   --roughness <n>      default 0.86 textured / 0.75 plain
//   --simplify <ratio>   keep about this fraction of the triangles (meshoptimizer), e.g. 0.35
//   --error <n>          simplifier error budget relative to the model size (default 0.0015)
//   --crease <deg>       rebuild normals: smooth below this angle, hard edges above (default: keep the
//                        OBJ normals; always rebuilt when simplifying)
//   --ao <rays>          bake ambient occlusion into vertex colours (default 48 without a texture, 0 with
//                        one). Gives untextured models their depth: shaded arches, domes, ground contact.
//   --ao-radius <n>      occlusion search distance relative to the model height (default 0.16)
//   --ao-strength <n>    0..1 (default 0.85)
//
// Output: base centred on the origin, sitting on y = 0, height = 1 (scale it in the scene), meshopt-
// compressed (decoded by three's GLTFLoader / drei useGLTF). Prints the normalised footprint.
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import * as THREE from "three";
import { mergeVertices, toCreasedNormals } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { Document, NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { EXTTextureWebP } from "@gltf-transform/extensions";
import { dedup, prune, meshopt } from "@gltf-transform/functions";
import { MeshoptEncoder, MeshoptDecoder, MeshoptSimplifier } from "meshoptimizer";
import { MeshBVH } from "three-mesh-bvh";

// ---- arguments ---------------------------------------------------------------------------------
const argv = process.argv.slice(2);
const pos = argv.filter((a, i) => !a.startsWith("--") && !(i > 0 && argv[i - 1].startsWith("--")));
const opt = (name, dflt) => { const i = argv.indexOf("--" + name); return i >= 0 ? argv[i + 1] : dflt; };
let objPath, texPath, outPath, maxSize;
if (pos.length >= 3 && /\.(png|jpe?g|webp)$/i.test(pos[1])) [objPath, texPath, outPath, maxSize] = pos;
else [objPath, outPath] = pos;
texPath = opt("texture", texPath);
maxSize = +(opt("max-texture", maxSize) ?? 2048);
const simplifyRatio = opt("simplify") ? +opt("simplify") : null;
const creaseDeg = opt("crease") ? +opt("crease") : simplifyRatio ? 40 : null;
if (!objPath || !outPath) {
  console.error("usage: node scripts/convert-landmark.mjs <model.obj> <out.glb> [--texture t.png] [--simplify 0.35] [--crease 40] [--color #efe9df]");
  process.exit(1);
}

// ---- parse OBJ (fan-triangulated, non-indexed) ----------------------------------------------------
const V = [], VT = [], VN = [];
const P = [], UV = [], N = [];
for (const raw of fs.readFileSync(objPath, "utf8").split(/\r?\n/)) {
  const line = raw.trim();
  if (!line || line.startsWith("#")) continue;
  const [tag, ...rest] = line.split(/\s+/);
  if (tag === "v") V.push(rest.slice(0, 3).map(Number));
  else if (tag === "vt") VT.push(rest.slice(0, 2).map(Number));
  else if (tag === "vn") VN.push(rest.slice(0, 3).map(Number));
  else if (tag === "f") {
    const idx = (i, n) => (i < 0 ? n + i : i - 1);
    const corners = rest.map((c) => {
      const [vi, ti, ni] = c.split("/");
      return { v: idx(+vi, V.length), t: ti ? idx(+ti, VT.length) : -1, n: ni ? idx(+ni, VN.length) : -1 };
    });
    for (let k = 1; k < corners.length - 1; k++) {
      for (const c of [corners[0], corners[k], corners[k + 1]]) {
        P.push(...V[c.v]);
        const t = c.t >= 0 ? VT[c.t] : [0, 0];
        UV.push(t[0], 1 - t[1]); // OBJ v-up -> glTF v-down
        N.push(...(c.n >= 0 ? VN[c.n] : [0, 1, 0]));
      }
    }
  }
}
if (!P.length) throw new Error("no faces in " + objPath);
const textured = !!texPath;
if (textured && !VT.length) throw new Error("--texture given but the OBJ has no UVs");
const srcTris = P.length / 9;

let g = new THREE.BufferGeometry();
g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
if (textured) g.setAttribute("uv", new THREE.Float32BufferAttribute(UV, 2));

// ---- optional simplification + crease normals ---------------------------------------------------
await MeshoptSimplifier.ready;
if (creaseDeg == null) {
  g.setAttribute("normal", new THREE.Float32BufferAttribute(N, 3));
} else {
  g = mergeVertices(g, 1e-5); // weld by position (+uv): shared vertices for the simplifier
  if (simplifyRatio) {
    const positions = g.getAttribute("position").array;
    const indices = new Uint32Array(g.getIndex().array);
    const target = Math.floor((indices.length * simplifyRatio) / 3) * 3;
    const [out, err] = MeshoptSimplifier.simplify(indices, positions, 3, target, +opt("error", 0.0015), ["LockBorder"]);
    g.setIndex(new THREE.BufferAttribute(out, 1));
    console.log(`simplified ${indices.length / 3} -> ${out.length / 3} triangles (error ${err.toFixed(5)})`);
  }
  g = toCreasedNormals(g, (creaseDeg * Math.PI) / 180);
  g = mergeVertices(g, 1e-5);
}

// ---- normalise: base centre at origin, height 1 ------------------------------------------------
g.computeBoundingBox();
const bb = g.boundingBox;
const height = bb.max.y - bb.min.y;
g.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2);
g.scale(1 / height, 1 / height, 1 / height);
g.normalizeNormals?.();

// ---- ambient occlusion -> vertex colours ---------------------------------------------------------
// Deterministic cosine-weighted hemisphere rays per vertex against the model (BVH) and the ground plane.
const aoRays = +opt("ao", textured ? 0 : 48);
let aoColors = null;
if (aoRays > 0) {
  if (!g.getIndex()) g = mergeVertices(g, 1e-6);
  const t0 = Date.now();
  const bvh = new MeshBVH(g);
  const posA = g.getAttribute("position"), nrmA = g.getAttribute("normal");
  const radius = +opt("ao-radius", 0.16), strength = +opt("ao-strength", 0.85);
  const dirs = Array.from({ length: aoRays }, (_, k) => {
    const u1 = (k + 0.5) / aoRays, u2 = (k * 0.6180339887) % 1;
    const r = Math.sqrt(u1), phi = 2 * Math.PI * u2;
    return [r * Math.cos(phi), r * Math.sin(phi), Math.sqrt(1 - u1)];
  });
  const ray = new THREE.Ray(), p = new THREE.Vector3(), n = new THREE.Vector3(), tA = new THREE.Vector3(), tB = new THREE.Vector3(), d = new THREE.Vector3();
  aoColors = new Float32Array(posA.count * 3);
  let sum = 0;
  for (let i = 0; i < posA.count; i++) {
    p.fromBufferAttribute(posA, i);
    n.fromBufferAttribute(nrmA, i).normalize();
    tA.set(Math.abs(n.y) < 0.9 ? 0 : 1, Math.abs(n.y) < 0.9 ? 1 : 0, 0).cross(n).normalize();
    tB.crossVectors(n, tA);
    let occ = 0;
    for (const [x, y, z] of dirs) {
      d.copy(tA).multiplyScalar(x).addScaledVector(tB, y).addScaledVector(n, z).normalize();
      ray.origin.copy(p).addScaledVector(n, 1e-4);
      ray.direction.copy(d);
      let dist = Infinity;
      if (d.y < 0 && p.y > -1e-4) dist = Math.max(0, p.y) / -d.y; // ground plane
      const hit = bvh.raycastFirst(ray, THREE.DoubleSide, 0, radius);
      if (hit) dist = Math.min(dist, hit.distance);
      if (dist < radius) occ += 1 - 0.5 * (dist / radius); // near occluders count more
    }
    const ao = Math.max(0.22, 1 - strength * (occ / aoRays));
    aoColors[i * 3] = aoColors[i * 3 + 1] = aoColors[i * 3 + 2] = ao;
    sum += ao;
  }
  console.log(`ambient occlusion: ${posA.count} vertices x ${aoRays} rays in ${((Date.now() - t0) / 1000).toFixed(1)} s, mean ${(sum / posA.count).toFixed(2)}`);
}

// ---- texture -> WebP -----------------------------------------------------------------------------
let webp = null;
if (textured) {
  const meta = await sharp(texPath).metadata();
  webp = await sharp(texPath)
    .resize({ width: Math.min(meta.width, maxSize), height: Math.min(meta.height, maxSize), fit: "inside" })
    .webp({ quality: 82, alphaQuality: 90, effort: 6 })
    .toBuffer();
}

// ---- glTF ----------------------------------------------------------------------------------------
const doc = new Document();
const buffer = doc.createBuffer();
const name = path.basename(outPath, ".glb");
const mat = doc.createMaterial(name).setMetallicFactor(0);
if (textured) {
  doc.createExtension(EXTTextureWebP).setRequired(true);
  const tex = doc.createTexture(name + "-albedo").setImage(new Uint8Array(webp)).setMimeType("image/webp");
  mat.setBaseColorTexture(tex).setRoughnessFactor(+opt("roughness", 0.86)).setAlphaMode("MASK").setAlphaCutoff(0.5).setDoubleSided(true);
} else {
  const c = new THREE.Color(opt("color", "#e8ddca")); // sRGB hex -> linear factors
  mat.setBaseColorFactor([c.r, c.g, c.b, 1]).setRoughnessFactor(+opt("roughness", 0.75));
}
const prim = doc
  .createPrimitive()
  .setAttribute("POSITION", doc.createAccessor().setType("VEC3").setArray(new Float32Array(g.getAttribute("position").array)).setBuffer(buffer))
  .setAttribute("NORMAL", doc.createAccessor().setType("VEC3").setArray(new Float32Array(g.getAttribute("normal").array)).setBuffer(buffer))
  .setMaterial(mat);
if (aoColors) prim.setAttribute("COLOR_0", doc.createAccessor().setType("VEC3").setArray(aoColors).setBuffer(buffer));
if (textured) prim.setAttribute("TEXCOORD_0", doc.createAccessor().setType("VEC2").setArray(new Float32Array(g.getAttribute("uv").array)).setBuffer(buffer));
if (g.getIndex()) prim.setIndices(doc.createAccessor().setType("SCALAR").setArray(new Uint32Array(g.getIndex().array)).setBuffer(buffer));
doc.createScene(name).addChild(doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(prim)));

await MeshoptEncoder.ready;
await doc.transform(dedup(), prune(), meshopt({ encoder: MeshoptEncoder, level: "medium" }));
fs.mkdirSync(path.dirname(outPath), { recursive: true });
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.encoder": MeshoptEncoder, "meshopt.decoder": MeshoptDecoder });
await io.write(outPath, doc);

g.computeBoundingBox();
const s = g.boundingBox;
const tris = (g.getIndex() ? g.getIndex().count : g.getAttribute("position").count) / 3;
console.log(
  `${outPath}: ${(fs.statSync(outPath).size / 1024).toFixed(0)} KB, ${tris} triangles (source ${srcTris})` + (webp ? `, texture ${(webp.length / 1024).toFixed(0)} KB` : ""),
  { width: +(s.max.x - s.min.x).toFixed(4), depth: +(s.max.z - s.min.z).toFixed(4), height: 1, sourceHeight: +height.toFixed(3) },
);
