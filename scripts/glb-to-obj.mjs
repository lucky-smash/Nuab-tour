// Landmark models that arrive as GLB (e.g. Sketchfab downloads) -> OBJ with per-vertex colours, for
// scripts/convert-landmark.mjs (simplify, crease normals, baked AO). Each material becomes one flat
// colour: its base colour factor times the mean of its base colour texture. At journey scale a
// monument reads by form and shading, not by surface texture, and this keeps the GLB small.
//
//   node scripts/glb-to-obj.mjs <in.glb> <out.obj>
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder } from "meshoptimizer";

const [inPath, outPath] = process.argv.slice(2);
if (!inPath || !outPath) {
  console.error("usage: node scripts/glb-to-obj.mjs <in.glb> <out.obj>");
  process.exit(1);
}
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder });
const doc = await io.read(inPath);

const toSRGB = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
const colourOf = new Map();
async function materialColour(mat) {
  if (!mat) return [0.8, 0.8, 0.8];
  if (colourOf.has(mat)) return colourOf.get(mat);
  const f = mat.getBaseColorFactor().slice(0, 3).map(toSRGB); // linear factor -> sRGB
  const tex = mat.getBaseColorTexture();
  let mean = [1, 1, 1];
  if (tex) {
    const { channels } = await sharp(Buffer.from(tex.getImage())).stats();
    mean = channels.slice(0, 3).map((c) => c.mean / 255);
  }
  const col = f.map((x, i) => x * mean[i]);
  console.log(`material "${mat.getName()}": ${col.map((x) => Math.round(x * 255).toString(16).padStart(2, "0")).join("")}`);
  colourOf.set(mat, col);
  return col;
}

const lines = [`# ${path.basename(inPath)} - scripts/glb-to-obj.mjs`];
const faces = [];
let base = 1, tris = 0;
const p = [0, 0, 0];
for (const node of doc.getRoot().listNodes()) {
  const mesh = node.getMesh();
  if (!mesh) continue;
  const m = node.getWorldMatrix();
  for (const prim of mesh.listPrimitives()) {
    if (prim.getMode() !== 4) continue; // triangles only
    const col = (await materialColour(prim.getMaterial())).map((x) => x.toFixed(4)).join(" ");
    const posA = prim.getAttribute("POSITION");
    for (let i = 0; i < posA.getCount(); i++) {
      posA.getElement(i, p);
      const x = m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12];
      const y = m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13];
      const z = m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14];
      lines.push(`v ${x.toFixed(5)} ${y.toFixed(5)} ${z.toFixed(5)} ${col}`);
    }
    const idx = prim.getIndices();
    const n = idx ? idx.getCount() : posA.getCount();
    for (let k = 0; k < n; k += 3) {
      const a = idx ? idx.getScalar(k) : k, b = idx ? idx.getScalar(k + 1) : k + 1, c = idx ? idx.getScalar(k + 2) : k + 2;
      faces.push(`f ${base + a} ${base + b} ${base + c}`);
    }
    tris += n / 3;
    base += posA.getCount();
  }
}
fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
fs.writeFileSync(outPath, lines.concat(faces).join("\n") + "\n");
console.log(`${outPath}: ${tris} triangles`);
