// QA: scroll-driven journey behaviour — determinism in both directions, resize, no duplication.
import { chromium } from "playwright-core";
const base = process.env.BASE || "http://localhost:3000";
const browser = await chromium.launch({ channel: "chrome", args: process.env.SWS ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] : [] });
const page = await browser.newPage({ viewport: { width: 1440, height: 860 } });
await page.addInitScript(() => { try { sessionStorage.setItem("nuab-intro", "1"); } catch {} });
await page.goto(base + "/", { waitUntil: "load", timeout: 120000 });
await page.waitForFunction(() => window.__nuabJourneyGoTo && window.__nuabJourney?.aircraft(), null, { timeout: 120000 });
await page.evaluate(() => { window.__nuabJourney.snap = true; });
const at = async (p) => { await page.evaluate((p) => window.__nuabJourneyGoTo(p), p); await page.waitForTimeout(1800); return page.evaluate(() => ({ p: +window.__nuabJourney.progress.toFixed(4), a: window.__nuabJourney.aircraft() })); };
const fwd = await at(0.27);
await at(0.6);
const back = await at(0.27);
const same = JSON.stringify(fwd.a.position) === JSON.stringify(back.a.position) && JSON.stringify(fwd.a.quaternion) === JSON.stringify(back.a.quaternion);
console.log("forward vs reverse at p=0.27:", same ? "IDENTICAL pose" : "DIFFERENT", JSON.stringify(fwd.a.position), JSON.stringify(back.a.position));
const p0 = await at(0);
const p1 = await at(1);
console.log("p=0", JSON.stringify(p0.a.position), "p=1", JSON.stringify(p1.a.position));
// monotonic travel along the path while scrolling down in small steps
let last = null, dist = 0;
for (let p = 0; p <= 1.0001; p += 0.05) { const r = await at(+p.toFixed(2)); if (last) { const d = Math.hypot(...r.a.position.map((v, i) => v - last[i])); dist += d; } last = r.a.position; }
console.log("path length sampled (world units):", dist.toFixed(1));
// resize mid-journey
await at(0.46);
const before = await page.evaluate(() => window.__nuabJourney.aircraft().position);
await page.setViewportSize({ width: 900, height: 1000 });
await page.waitForTimeout(2500);
const after = await page.evaluate(() => ({ p: window.__nuabJourney.progress, a: window.__nuabJourney.aircraft().position }));
console.log("resize 1440x860 -> 900x1000 at p≈0.46: progress", after.p.toFixed(3), "aircraft", JSON.stringify(before), "->", JSON.stringify(after.a));
// exactly one aircraft & one canvas
console.log("canvases:", await page.locator("#journey canvas").count(), "| panels visible:", await page.evaluate(() => [...document.querySelectorAll("[data-panel]")].filter((e) => getComputedStyle(e).visibility === "visible").map((e) => e.dataset.panel).join(",")));
await browser.close();
