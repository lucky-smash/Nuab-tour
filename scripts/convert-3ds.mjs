/**
 * Converts the client's original airliner model (assets/source/3d-model.3ds, a SketchUp export)
 * into an optimised, correctly assembled GLB for the web: public/models/nuab-aircraft.glb.
 *
 * Why a custom converter: in this file the right-hand landing gear, engine, fan blades and
 * nacelle exist only as *keyframer instances* (mirrored, negative-scale copies), and every mesh's
 * stored vertices must be re-placed through its keyframer node transform. three.js' TDSLoader
 * ignores the keyframer, which yields a half-missing, mis-assembled aircraft.
 *
 *   world = T(pos) · R(rot) · S(scl) · T(-pivot) · inverse(meshMatrix) · v
 *
 * Output frame: three.js Y-up, nose pointing +Z, fuselage centred on the origin, length = LENGTH.
 * The source asset is never modified.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as THREE from "three";
import { mergeVertices, toCreasedNormals } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { Document, NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { meshopt, prune, dedup } from "@gltf-transform/functions";
import { MeshoptEncoder, MeshoptDecoder } from "meshoptimizer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "assets", "source", "3d-model.3ds");
const OUT = path.join(ROOT, "public", "models", "nuab-aircraft.glb");
const REPORT = path.join(ROOT, "assets", "aircraft-report.json");
const LENGTH = 10; // metres-ish scene units, nose to tail
// -1 validated: every mirrored pair (incl. 24 fan blades per engine) lands symmetric about x = 0.
const ROT_SIGN = Number(process.env.ROT_SIGN || -1);

const data = fs.readFileSync(SRC);
const u16 = (o) => data.readUInt16LE(o);
const u32 = (o) => data.readUInt32LE(o);
const f32 = (o) => data.readFloatLE(o);
const cstr = (o) => { let e = o; while (data[e] !== 0) e++; return [data.toString("latin1", o, e), e + 1]; };

// ---------------------------------------------------------------------------
// Parse
// ---------------------------------------------------------------------------
const materials = new Map(); // name -> {diffuse:[r,g,b], transparency, texture}
const meshes = new Map(); // name -> {verts:Float32Array, faces:Uint16Array(n*3), faceMat: string[], matrix:number[12]}
const nodes = [];

function readColor(start, end) {
  let o = start;
  let col = null;
  while (o + 6 <= end) {
    const id = u16(o), len = u32(o + 2);
    if (!col && (id === 0x0011 || id === 0x0012)) col = [data[o + 6] / 255, data[o + 7] / 255, data[o + 8] / 255];
    if (!col && (id === 0x0010 || id === 0x0013)) col = [f32(o + 6), f32(o + 10), f32(o + 14)];
    o += len;
  }
  return col;
}
function readPct(start, end) {
  let o = start;
  while (o + 6 <= end) {
    const id = u16(o), len = u32(o + 2);
    if (id === 0x0030) return u16(o + 6) / 100;
    if (id === 0x0031) return f32(o + 6) / 100;
    o += len;
  }
  return 0;
}

function walk(start, end, ctx) {
  let o = start;
  while (o + 6 <= end) {
    const id = u16(o), len = u32(o + 2), body = o + 6, cend = o + len;
    switch (id) {
      case 0x4d4d: case 0x3d3d: case 0xb000: walk(body, cend, ctx); break;
      case 0xafff: { const m = { diffuse: [1, 1, 1], transparency: 0, texture: null }; walk(body, cend, { mat: m }); materials.set(m.name, m); break; }
      case 0xa000: ctx.mat.name = cstr(body)[0]; break;
      case 0xa020: ctx.mat.diffuse = readColor(body, cend) || ctx.mat.diffuse; break;
      case 0xa050: ctx.mat.transparency = readPct(body, cend); break;
      case 0xa200: walk(body, cend, ctx); break;
      case 0xa300: ctx.mat.texture = cstr(body)[0]; break;
      case 0x4000: { const [name, p] = cstr(body); const m = { name, verts: null, faces: null, faceMat: null, uvs: null, matrix: null }; walk(p, cend, { mesh: m }); if (m.verts) meshes.set(name, m); break; }
      case 0x4100: walk(body, cend, ctx); break;
      case 0x4110: { const n = u16(body); const v = new Float32Array(n * 3); for (let i = 0; i < n * 3; i++) v[i] = f32(body + 2 + i * 4); ctx.mesh.verts = v; break; }
      case 0x4120: {
        const n = u16(body); const f = new Uint16Array(n * 3);
        for (let i = 0; i < n; i++) { f[i * 3] = u16(body + 2 + i * 8); f[i * 3 + 1] = u16(body + 4 + i * 8); f[i * 3 + 2] = u16(body + 6 + i * 8); }
        ctx.mesh.faces = f; ctx.mesh.faceMat = new Array(n).fill(null);
        walk(body + 2 + n * 8, cend, ctx); break;
      }
      case 0x4130: { const [mname, p] = cstr(body); const n = u16(p); for (let i = 0; i < n; i++) ctx.mesh.faceMat[u16(p + 2 + i * 2)] = mname; break; }
      case 0x4160: { const m = []; for (let i = 0; i < 12; i++) m.push(f32(body + i * 4)); ctx.mesh.matrix = m; break; }
      case 0xb002: { const nd = { name: null, inst: null, pivot: [0, 0, 0], pos: [0, 0, 0], rot: [0, 1, 0, 0], scl: [1, 1, 1] }; walk(body, cend, { node: nd }); nodes.push(nd); break; }
      case 0xb010: if (ctx.node) ctx.node.name = cstr(body)[0]; break;
      case 0xb011: if (ctx.node) ctx.node.inst = cstr(body)[0]; break;
      case 0xb013: if (ctx.node) ctx.node.pivot = [f32(body), f32(body + 4), f32(body + 8)]; break;
      case 0xb020: case 0xb021: case 0xb022: {
        if (!ctx.node) break;
        const nkeys = u32(body + 10);
        if (!nkeys) break;
        let k = body + 14;
        const kflags = u16(k + 4); k += 6;
        for (let b = 0; b < 5; b++) if (kflags & (1 << b)) k += 4;
        if (id === 0xb020) ctx.node.pos = [f32(k), f32(k + 4), f32(k + 8)];
        if (id === 0xb022) ctx.node.scl = [f32(k), f32(k + 4), f32(k + 8)];
        if (id === 0xb021) ctx.node.rot = [f32(k), f32(k + 4), f32(k + 8), f32(k + 12)];
        break;
      }
      default: break;
    }
    o += len;
  }
}
walk(0, data.length, {});
console.log(`parsed: ${materials.size} materials, ${meshes.size} meshes, ${nodes.length} keyframer nodes`);

// ---------------------------------------------------------------------------
// Assemble instances in world space (3DS frame: Z-up, nose -Y)
// ---------------------------------------------------------------------------
const meshMatrix = (m) => new THREE.Matrix4().set(m[3 * 0 + 0], m[3 * 1 + 0], m[3 * 2 + 0], m[9], m[3 * 0 + 1], m[3 * 1 + 1], m[3 * 2 + 1], m[10], m[3 * 0 + 2], m[3 * 1 + 2], m[3 * 2 + 2], m[11], 0, 0, 0, 1);

function nodeMatrix(nd) {
  const [ang, ax, ay, az] = nd.rot;
  const axis = new THREE.Vector3(ax, ay, az);
  const q = new THREE.Quaternion();
  if (axis.lengthSq() > 1e-12 && Math.abs(ang) > 1e-9) q.setFromAxisAngle(axis.normalize(), ROT_SIGN * ang);
  const M = new THREE.Matrix4().makeTranslation(nd.pos[0], nd.pos[1], nd.pos[2]);
  M.multiply(new THREE.Matrix4().makeRotationFromQuaternion(q));
  M.multiply(new THREE.Matrix4().makeScale(nd.scl[0], nd.scl[1], nd.scl[2]));
  M.multiply(new THREE.Matrix4().makeTranslation(-nd.pivot[0], -nd.pivot[1], -nd.pivot[2]));
  return M;
}

// 3DS (Z-up, nose -Y) -> three (Y-up, nose +Z): x'=x, y'=z, z'=-y (proper rotation, det +1)
const FRAME = new THREE.Matrix4().set(1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1);

const instances = nodes
  .filter((nd) => meshes.has(nd.name))
  .map((nd, i) => {
    const mesh = meshes.get(nd.name);
    const MM = meshMatrix(mesh.matrix);
    // 3ds Max quirk (also handled by Assimp's 3DS importer): objects whose mesh matrix has a negative
    // determinant (mirrored in Max) store their vertices un-mirrored; mirror them in local X.
    const localFix = MM.determinant() < 0 ? new THREE.Matrix4().makeScale(-1, 1, 1) : new THREE.Matrix4();
    const M = FRAME.clone().multiply(nodeMatrix(nd)).multiply(localFix).multiply(MM.clone().invert());
    const id = nd.inst || nd.name;
    return { id, mesh: nd.name, M, flip: M.determinant() < 0, order: i };
  });
console.log(`instances: ${instances.length}, mirrored (det<0): ${instances.filter((x) => x.flip).length}`);

function instanceBox(inst) {
  const m = meshes.get(inst.mesh);
  const box = new THREE.Box3();
  const v = new THREE.Vector3();
  for (let i = 0; i < m.verts.length; i += 3) box.expandByPoint(v.set(m.verts[i], m.verts[i + 1], m.verts[i + 2]).applyMatrix4(inst.M));
  return box;
}

// Centre on the fuselage (largest mesh) axis and scale to LENGTH
const fuselageInst = instances.find((x) => x.mesh === "Group_001");
const fbox = instanceBox(fuselageInst);
const allBox = new THREE.Box3();
for (const inst of instances) allBox.union(instanceBox(inst));
const centre = new THREE.Vector3((fbox.min.x + fbox.max.x) / 2, (fbox.min.y + fbox.max.y) / 2, (allBox.min.z + allBox.max.z) / 2);
const scale = LENGTH / (allBox.max.z - allBox.min.z);
const NORM = new THREE.Matrix4().makeScale(scale, scale, scale).multiply(new THREE.Matrix4().makeTranslation(-centre.x, -centre.y, -centre.z));
for (const inst of instances) inst.M = NORM.clone().multiply(inst.M);

// ---------------------------------------------------------------------------
// Validation: mirrored pairs must land symmetric about x = 0
// ---------------------------------------------------------------------------
const byMesh = new Map();
for (const inst of instances) { if (!byMesh.has(inst.mesh)) byMesh.set(inst.mesh, []); byMesh.get(inst.mesh).push(inst); }
const boxCentre = (b) => b.getCenter(new THREE.Vector3());
let worstAsym = 0;
const pairReport = [];
for (const [name, list] of byMesh) {
  if (list.length !== 2) continue;
  const a = boxCentre(instanceBox(list[0])), b = boxCentre(instanceBox(list[1]));
  const asym = Math.abs(a.x + b.x) + Math.abs(a.y - b.y) + Math.abs(a.z - b.z);
  worstAsym = Math.max(worstAsym, asym);
  pairReport.push({ name, left: a.toArray().map((n) => +n.toFixed(3)), right: b.toArray().map((n) => +n.toFixed(3)), asym: +asym.toFixed(4) });
}
// Also: named left/right part pairs that are separate meshes (wings, stabilisers)
const namedPairs = [["Group_059", "Group_021"], ["Group_064", "Group_026"], ["Group_099", "Group_098"], ["Group_096", "Group_058"], ["Group_095", "Group_057"], ["Group_065", "Group_027"]];
for (const [l, r] of namedPairs) {
  const a = boxCentre(instanceBox(byMesh.get(l)[0])), b = boxCentre(instanceBox(byMesh.get(r)[0]));
  const asym = Math.abs(a.x + b.x) + Math.abs(a.y - b.y) + Math.abs(a.z - b.z);
  worstAsym = Math.max(worstAsym, asym);
  pairReport.push({ name: `${l}/${r}`, left: a.toArray().map((n) => +n.toFixed(3)), right: b.toArray().map((n) => +n.toFixed(3)), asym: +asym.toFixed(4) });
}
console.log(`symmetry check: worst asymmetry ${worstAsym.toFixed(4)} units (ROT_SIGN=${ROT_SIGN})`);

// ---------------------------------------------------------------------------
// Part classification (named nodes the runtime animates / decorates)
// ---------------------------------------------------------------------------
const GEAR = new Set(["Group#39_0", "Group_111", "Component#", "Group_109", "Group_100", "Group_101", "Group_102", "Group_103", "Group_104", "Group_105", "Group_106", "Group_006", "Group_007", "Group_008", "Group_009", "Group_010", "Group_011"]);
const FAN = new Set(["Group_067", ...Array.from({ length: 24 }, (_, i) => `Group_0${68 + i}`)]);
const TAIL = new Set(["Component1", "Group_107"]);
function partOf(inst) {
  if (inst.mesh === "Group_001") return "fuselage";
  if (GEAR.has(inst.mesh)) return "gear";
  if (FAN.has(inst.mesh)) return boxCentre(instanceBox(inst)).x < 0 ? "fan_left" : "fan_right";
  if (TAIL.has(inst.mesh)) return "tail_fin";
  return "airframe";
}

// ---------------------------------------------------------------------------
// Materials (3DS flat colours -> PBR); see assets/aircraft-materials.json
// ---------------------------------------------------------------------------
const MATS = JSON.parse(fs.readFileSync(path.join(ROOT, "assets", "aircraft-materials.json"), "utf8"));
function matKey(srcName, part) {
  if (part === "tail_fin" && srcName === "skp_front_defaul") return "livery_navy";
  const m = MATS.map[srcName];
  if (!m) { console.warn("unmapped material:", srcName); return "paint_white"; }
  return m;
}

// ---------------------------------------------------------------------------
// Build geometry buckets: part -> material -> triangles
// ---------------------------------------------------------------------------
const buckets = new Map();
const v = new THREE.Vector3();
for (const inst of instances) {
  const part = partOf(inst);
  const m = meshes.get(inst.mesh);
  const world = new Float32Array(m.verts.length);
  for (let i = 0; i < m.verts.length; i += 3) { v.set(m.verts[i], m.verts[i + 1], m.verts[i + 2]).applyMatrix4(inst.M); world[i] = v.x; world[i + 1] = v.y; world[i + 2] = v.z; }
  for (let f = 0; f < m.faces.length / 3; f++) {
    const key = matKey(m.faceMat[f] || "skp_front_defaul", part);
    if (!buckets.has(part)) buckets.set(part, new Map());
    const pb = buckets.get(part);
    if (!pb.has(key)) pb.set(key, []);
    const arr = pb.get(key);
    let a = m.faces[f * 3], b = m.faces[f * 3 + 1], c = m.faces[f * 3 + 2];
    if (inst.flip) [b, c] = [c, b];
    arr.push(world[a * 3], world[a * 3 + 1], world[a * 3 + 2], world[b * 3], world[b * 3 + 1], world[b * 3 + 2], world[c * 3], world[c * 3 + 1], world[c * 3 + 2]);
  }
}

// Fans spin about their own axis: compute each fan's centre so its node origin sits on the axis
const partOrigin = {};
for (const part of ["fan_left", "fan_right"]) {
  const box = new THREE.Box3();
  for (const arr of buckets.get(part).values()) for (let i = 0; i < arr.length; i += 3) box.expandByPoint(v.set(arr[i], arr[i + 1], arr[i + 2]));
  partOrigin[part] = boxCentre(box);
}

// ---------------------------------------------------------------------------
// Write GLB with gltf-transform
// ---------------------------------------------------------------------------
const doc = new Document();
doc.createBuffer();
const scene = doc.createScene("NUAB Aircraft");
const rootNode = doc.createNode("NUAB_Aircraft");
scene.addChild(rootNode);

const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const gltfMats = new Map();
for (const [key, def] of Object.entries(MATS.materials)) {
  const rgb = [1, 3, 5].map((i) => parseInt(def.color.slice(i, i + 2), 16) / 255).map(srgbToLinear);
  const mat = doc.createMaterial(key).setBaseColorFactor([...rgb, def.opacity ?? 1]).setMetallicFactor(def.metalness).setRoughnessFactor(def.roughness);
  if ((def.opacity ?? 1) < 1) mat.setAlphaMode("BLEND");
  if (def.doubleSided) mat.setDoubleSided(true);
  gltfMats.set(key, mat);
}

const stats = { parts: {}, triangles: 0 };
for (const [part, mats] of buckets) {
  const node = doc.createNode(part);
  const origin = partOrigin[part] || new THREE.Vector3();
  node.setTranslation(origin.toArray());
  const mesh = doc.createMesh(part);
  let tris = 0;
  for (const [key, arr] of mats) {
    let g = new THREE.BufferGeometry();
    const pos = new Float32Array(arr.length);
    for (let i = 0; i < arr.length; i += 3) { pos[i] = arr[i] - origin.x; pos[i + 1] = arr[i + 1] - origin.y; pos[i + 2] = arr[i + 2] - origin.z; }
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    // Smooth the skin but keep panel edges, wing trailing edges and window frames crisp
    g = toCreasedNormals(g, MATS.materials[key].crease ?? Math.PI / 4);
    g.deleteAttribute("uv");
    g = mergeVertices(g, 1e-5);
    const p = g.getAttribute("position"), n = g.getAttribute("normal"), idx = g.getIndex();
    const prim = doc.createPrimitive()
      .setAttribute("POSITION", doc.createAccessor().setType("VEC3").setArray(new Float32Array(p.array)))
      .setAttribute("NORMAL", doc.createAccessor().setType("VEC3").setArray(new Float32Array(n.array)))
      .setIndices(doc.createAccessor().setType("SCALAR").setArray(p.count > 65535 ? new Uint32Array(idx.array) : new Uint16Array(idx.array)))
      .setMaterial(gltfMats.get(key));
    mesh.addPrimitive(prim);
    tris += idx.count / 3;
  }
  node.setMesh(mesh);
  rootNode.addChild(node);
  stats.parts[part] = { triangles: tris, materials: [...mats.keys()] };
  stats.triangles += tris;
}

const finalBox = new THREE.Box3();
for (const mats of buckets.values()) for (const arr of mats.values()) for (let i = 0; i < arr.length; i += 3) finalBox.expandByPoint(v.set(arr[i], arr[i + 1], arr[i + 2]));
rootNode.setExtras({ source: "assets/source/3d-model.3ds", converter: "scripts/convert-3ds.mjs", forward: "+Z", up: "+Y", bbox: { min: finalBox.min.toArray(), max: finalBox.max.toArray() } });

await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.encoder": MeshoptEncoder, "meshopt.decoder": MeshoptDecoder });
await doc.transform(prune(), dedup(), meshopt({ encoder: MeshoptEncoder, level: "medium" }));
fs.mkdirSync(path.dirname(OUT), { recursive: true });
await io.write(OUT, doc);

const report = {
  source: path.relative(ROOT, SRC),
  output: path.relative(ROOT, OUT),
  bytes: fs.statSync(OUT).size,
  rotSign: ROT_SIGN,
  worstMirrorAsymmetry: +worstAsym.toFixed(4),
  bbox: { min: finalBox.min.toArray().map((n) => +n.toFixed(3)), max: finalBox.max.toArray().map((n) => +n.toFixed(3)) },
  fanOrigins: Object.fromEntries(Object.entries(partOrigin).map(([k, o]) => [k, o.toArray().map((n) => +n.toFixed(3))])),
  ...stats,
  pairs: pairReport,
};
fs.writeFileSync(REPORT, JSON.stringify(report, null, 2));
console.log(`wrote ${report.output} (${(report.bytes / 1024).toFixed(0)} KB), ${stats.triangles} triangles, bbox`, report.bbox);
console.log(Object.entries(stats.parts).map(([k, s]) => `${k}: ${s.triangles} tris [${s.materials.join(", ")}]`).join("\n"));
