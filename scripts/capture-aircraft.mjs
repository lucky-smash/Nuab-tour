// Renders /dev-preview/aircraft (the real model + livery decals) and saves the static fallback
// image used when 3D is unavailable or reduced motion is preferred: public/media/aircraft-hero.png
import { chromium } from "playwright-core";
import sharp from "sharp";
const browser = await chromium.launch({ channel: "chrome", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
await page.addInitScript(() => { try { sessionStorage.setItem("nuab-intro", "1"); } catch {} });
await page.goto("http://localhost:3000/dev-preview/aircraft/", { waitUntil: "networkidle", timeout: 180000 });
await page.addStyleTag({ content: "header,footer,nextjs-portal{display:none!important} html,body{background:transparent!important}" });
await page.waitForFunction(() => document.title === "ready", null, { timeout: 120000 });
await page.waitForTimeout(4000);
const buf = await page.locator("canvas").screenshot({ omitBackground: true });
await sharp(buf).trim({ threshold: 1 }).resize({ width: 1600, withoutEnlargement: true }).png({ compressionLevel: 9 }).toFile("public/media/aircraft-hero.png");
const m = await sharp("public/media/aircraft-hero.png").metadata();
console.log("aircraft-hero.png", m.width, "x", m.height);
// the page serves these (srcset in Journey.tsx StaticJourney): ~25–50 KB instead of the ~300 KB PNG
for (const w of [800, 1200, 1600]) {
  await sharp("public/media/aircraft-hero.png").resize(w).webp({ quality: 82, alphaQuality: 90, effort: 6 }).toFile(`public/media/aircraft-hero-${w}.webp`);
}
console.log("aircraft-hero-{800,1200,1600}.webp written");
await browser.close();
