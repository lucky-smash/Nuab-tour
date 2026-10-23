// Copies MapLibre's self-contained web worker into public/ (it is resolved at runtime, so the
// bundler cannot pick it up). Runs automatically before `dev` and `build`.
import fs from "node:fs";
import path from "node:path";
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1")), "..");
const src = path.join(root, "node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs");
const dest = path.join(root, "public/vendor/maplibre-gl-worker.mjs");
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.copyFileSync(src, dest);
console.log("vendor: maplibre worker ->", path.relative(root, dest));
