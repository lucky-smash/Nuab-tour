// Landmark model pipeline: textured OBJ (+ one baked texture atlas) -> compact GLB for the journey.
//
//   node scripts/convert-landmark.mjs <model.obj> <texture.png> <out.glb> [maxTextureSize=2048]
//
// - Y-up OBJ, triangles or polygons (fan-triangulated), v/vt/vn indices.
// - Normalised: base centred on the origin, sitting on y = 0, height = 1 (scale it in the scene).
// - Texture -> WebP (EXT_texture_webp, keeps the alpha cut-outs); material uses alpha MASK so cut-out
//   cards (e.g. rifles, finials) render crisply without transparency sorting.
// - Prints the normalised footprint (width/depth relative to height) for placing it in the scene.
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { Document, NodeIO } from "@gltf-transform/core";
import { EXTTextureWebP } from "@gltf-transform/extensions";
import { weld, dedup, prune } from "@gltf-transform/functions";

const [objPath, texPath, outPath, maxSizeArg = "2048"] = process.argv.slice(2);
if (!objPath || !texPath || !outPath) {
  console.error("usage: node scripts/convert-landmark.mjs <model.obj> <texture.png> <out.glb> [maxTextureSize]");
  process.exit(1);
}

// ---- parse OBJ --------------------------------------------------------------------------------
const V = [], VT = [], VN = [];
const pos = [], uv = [], nrm = [];
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
        pos.push(...V[c.v]);
        const t = c.t >= 0 ? VT[c.t] : [0, 0];
        uv.push(t[0], 1 - t[1]); // OBJ v-up -> glTF v-down
        nrm.push(...(c.n >= 0 ? VN[c.n] : [0, 1, 0]));
      }
    }
  }
}
if (!pos.length) throw new Error("no faces in " + objPath);

// ---- normalise: base centre at origin, height 1 ------------------------------------------------
const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
for (let i = 0; i < pos.length; i += 3) for (let a = 0; a < 3; a++) { min[a] = Math.min(min[a], pos[i + a]); max[a] = Math.max(max[a], pos[i + a]); }
const height = max[1] - min[1];
const cx = (min[0] + max[0]) / 2, cz = (min[2] + max[2]) / 2;
const P = new Float32Array(pos.length);
for (let i = 0; i < pos.length; i += 3) {
  P[i] = (pos[i] - cx) / height;
  P[i + 1] = (pos[i + 1] - min[1]) / height;
  P[i + 2] = (pos[i + 2] - cz) / height;
}
const N = new Float32Array(nrm);
for (let i = 0; i < N.length; i += 3) { const l = Math.hypot(N[i], N[i + 1], N[i + 2]) || 1; N[i] /= l; N[i + 1] /= l; N[i + 2] /= l; }

// ---- texture -> WebP ---------------------------------------------------------------------------
const maxSize = +maxSizeArg;
const meta = await sharp(texPath).metadata();
const webp = await sharp(texPath)
  .resize({ width: Math.min(meta.width, maxSize), height: Math.min(meta.height, maxSize), fit: "inside" })
  .webp({ quality: 82, alphaQuality: 90, effort: 6 })
  .toBuffer();

// ---- glTF ----------------------------------------------------------------------------------------
const doc = new Document();
doc.createExtension(EXTTextureWebP).setRequired(true);
const buffer = doc.createBuffer();
const name = path.basename(outPath, ".glb");
const tex = doc.createTexture(name + "-albedo").setImage(new Uint8Array(webp)).setMimeType("image/webp");
const mat = doc
  .createMaterial(name)
  .setBaseColorTexture(tex)
  .setRoughnessFactor(0.86)
  .setMetallicFactor(0)
  .setAlphaMode("MASK")
  .setAlphaCutoff(0.5)
  .setDoubleSided(true);
const prim = doc
  .createPrimitive()
  .setAttribute("POSITION", doc.createAccessor().setType("VEC3").setArray(P).setBuffer(buffer))
  .setAttribute("NORMAL", doc.createAccessor().setType("VEC3").setArray(N).setBuffer(buffer))
  .setAttribute("TEXCOORD_0", doc.createAccessor().setType("VEC2").setArray(new Float32Array(uv)).setBuffer(buffer))
  .setMaterial(mat);
const mesh = doc.createMesh(name).addPrimitive(prim);
doc.createScene(name).addChild(doc.createNode(name).setMesh(mesh));
await doc.transform(weld(), dedup(), prune());

fs.mkdirSync(path.dirname(outPath), { recursive: true });
await new NodeIO().registerExtensions([EXTTextureWebP]).write(outPath, doc);
const footprint = { width: +((max[0] - min[0]) / height).toFixed(4), depth: +((max[2] - min[2]) / height).toFixed(4), height: 1, sourceHeight: +height.toFixed(3), triangles: pos.length / 9 };
console.log(`${outPath}: ${(fs.statSync(outPath).size / 1024).toFixed(0)} KB, ${footprint.triangles} triangles, texture ${(webp.length / 1024).toFixed(0)} KB`, footprint);
