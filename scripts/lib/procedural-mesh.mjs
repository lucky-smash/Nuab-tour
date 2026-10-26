// Shared helpers for the procedural landmark generators (build-hawa-mahal.mjs, build-laxman-jhula.mjs):
// coloured triangles with winding fixed against an outward hint, a few architectural primitives, and
// an OBJ writer with per-vertex colours (`v x y z r g b`) for scripts/convert-landmark.mjs.
import fs from "node:fs";
import path from "node:path";

export const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a) => { const l = Math.hypot(...a); return [a[0] / l, a[1] / l, a[2] / l]; };

export function createMesh() {
  const tris = [];
  function tri(a, b, c, col, outward) {
    const n = cross(sub(b, a), sub(c, a));
    tris.push(dot(n, outward) >= 0 ? [a, b, c, col] : [a, c, b, col]);
  }
  function quad(a, b, c, d, col, outward) {
    tri(a, b, c, col, outward);
    tri(a, c, d, col, outward);
  }
  function box(x0, x1, y0, y1, z0, z1, col) {
    const p = (x, y, z) => [x, y, z];
    quad(p(x0, y0, z1), p(x1, y0, z1), p(x1, y1, z1), p(x0, y1, z1), col, [0, 0, 1]);
    quad(p(x0, y0, z0), p(x1, y0, z0), p(x1, y1, z0), p(x0, y1, z0), col, [0, 0, -1]);
    quad(p(x0, y0, z0), p(x0, y0, z1), p(x0, y1, z1), p(x0, y1, z0), col, [-1, 0, 0]);
    quad(p(x1, y0, z0), p(x1, y0, z1), p(x1, y1, z1), p(x1, y1, z0), col, [1, 0, 0]);
    quad(p(x0, y1, z0), p(x1, y1, z0), p(x1, y1, z1), p(x0, y1, z1), col, [0, 1, 0]);
    quad(p(x0, y0, z0), p(x1, y0, z0), p(x1, y0, z1), p(x0, y0, z1), col, [0, -1, 0]);
  }
  /** vertical prism over a convex xz polygon (closed) */
  function prism(poly, y0, y1, col, { bottom = true } = {}) {
    const cx = poly.reduce((s, q) => s + q[0], 0) / poly.length, cz = poly.reduce((s, q) => s + q[1], 0) / poly.length;
    for (let i = 0; i < poly.length; i++) {
      const [ax, az] = poly[i], [bx, bz] = poly[(i + 1) % poly.length];
      const out = [(ax + bx) / 2 - cx, 0, (az + bz) / 2 - cz];
      quad([ax, y0, az], [bx, y0, bz], [bx, y1, bz], [ax, y1, az], col, out);
    }
    for (let i = 1; i < poly.length - 1; i++) {
      tri([poly[0][0], y1, poly[0][1]], [poly[i][0], y1, poly[i][1]], [poly[i + 1][0], y1, poly[i + 1][1]], col, [0, 1, 0]);
      if (bottom) tri([poly[0][0], y0, poly[0][1]], [poly[i][0], y0, poly[i][1]], [poly[i + 1][0], y0, poly[i + 1][1]], col, [0, -1, 0]);
    }
  }
  /** onion-ish dome: a slight bulge, drawn to a point, with a slender finial */
  function dome(cx, y0, cz, r, h, col, seg = 10, finial = col) {
    const prof = [[1, 0], [1.08, 0.18], [1.02, 0.4], [0.8, 0.62], [0.48, 0.82], [0.16, 0.95]];
    const ring = (k) => Array.from({ length: seg }, (_, i) => {
      const a = (2 * Math.PI * i) / seg;
      return [cx + r * prof[k][0] * Math.cos(a), y0 + h * prof[k][1], cz + r * prof[k][0] * Math.sin(a)];
    });
    for (let k = 0; k < prof.length - 1; k++) {
      const A = ring(k), B = ring(k + 1);
      for (let i = 0; i < seg; i++) {
        const j = (i + 1) % seg;
        quad(A[i], A[j], B[j], B[i], col, sub(A[i], [cx, y0, cz]));
      }
    }
    const top = ring(prof.length - 1), apex = [cx, y0 + h, cz];
    for (let i = 0; i < seg; i++) tri(top[i], top[(i + 1) % seg], apex, col, [0, 1, 0]);
    // finial: thin square spike
    const f = r * 0.09, fy = y0 + h * 0.97;
    const fp = [[cx - f, cz - f], [cx + f, cz - f], [cx + f, cz + f], [cx - f, cz + f]];
    for (let i = 0; i < 4; i++) {
      const [ax, az] = fp[i], [bx, bz] = fp[(i + 1) % 4];
      tri([ax, fy, az], [bx, fy, bz], [cx, fy + h * 0.42, cz], finial, [(ax + bx) / 2 - cx, 0.2, (az + bz) / 2 - cz]);
    }
  }
  /**
   * flat arch panel (rectangle with a round top; `pointed` draws a pointed arch). Lies in the plane
   * z = at facing ±z (axis "z"), or x = at facing ±x (axis "x", u then runs along z).
   */
  function arch(u, y0, w, h, at, col, { axis = "z", sign = 1, pointed = false } = {}) {
    const r = w / 2, spring = y0 + h - (pointed ? r * 1.25 : r), pts = [[u - r, y0], [u + r, y0]];
    for (let i = 0; i <= 8; i++) {
      const a = (Math.PI * i) / 8;
      const s = pointed ? Math.pow(Math.sin(a), 0.6) * 1.25 : Math.sin(a);
      pts.push([u + r * Math.cos(a), spring + r * s]);
    }
    const map = ([pu, pv]) => (axis === "z" ? [pu, pv, at] : [at, pv, pu]);
    const out = axis === "z" ? [0, 0, sign] : [sign, 0, 0];
    const c = map([u, y0 + h * 0.45]);
    for (let i = 0; i < pts.length; i++) tri(c, map(pts[i]), map(pts[(i + 1) % pts.length]), col, out);
  }
  /** square-section beam from a to b (cables, stays, hangers, rails) */
  function beam(a, b, t, col) {
    const d = norm(sub(b, a));
    const e1 = norm(cross(d, Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]));
    const e2 = cross(d, e1);
    const off = (p, s1, s2) => [p[0] + (e1[0] * s1 + e2[0] * s2) * t, p[1] + (e1[1] * s1 + e2[1] * s2) * t, p[2] + (e1[2] * s1 + e2[2] * s2) * t];
    const sq = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
    for (let i = 0; i < 4; i++) {
      const [s1, s2] = sq[i], [u1, u2] = sq[(i + 1) % 4];
      const out = [e1[0] * (s1 + u1) + e2[0] * (s2 + u2), e1[1] * (s1 + u1) + e2[1] * (s2 + u2), e1[2] * (s1 + u1) + e2[2] * (s2 + u2)];
      quad(off(a, s1, s2), off(a, u1, u2), off(b, u1, u2), off(b, s1, s2), col, out);
    }
    for (const [p, s] of [[a, -1], [b, 1]]) quad(off(p, 1, 1), off(p, -1, 1), off(p, -1, -1), off(p, 1, -1), col, [d[0] * s, d[1] * s, d[2] * s]);
  }
  /** write the triangles as an OBJ with per-vertex colours */
  function writeObj(file, header) {
    const lines = [`# ${header}`];
    const f = (v) => +v.toFixed(4);
    const faces = [];
    let vi = 1;
    for (const [a, b, c, col] of tris) {
      for (const p of [a, b, c]) lines.push(`v ${f(p[0])} ${f(p[1])} ${f(p[2])} ${col.map((x) => x.toFixed(4)).join(" ")}`);
      faces.push(`f ${vi} ${vi + 1} ${vi + 2}`);
      vi += 3;
    }
    fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
    fs.writeFileSync(file, lines.concat(faces).join("\n") + "\n");
  }
  return { tris, tri, quad, box, prism, dome, arch, beam, writeObj };
}
