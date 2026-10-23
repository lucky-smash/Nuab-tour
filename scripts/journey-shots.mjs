// Dev QA: screenshot the scroll journey at given progress values.
// usage: node scripts/journey-shots.mjs <prefix> <w> <h> p1 p2 ... [--mobile]
import { chromium } from "playwright-core";
const [prefix, w, h, ...rest] = process.argv.slice(2);
const mobile = rest.includes("--mobile");
const ps = rest.filter((x) => !x.startsWith("--")).map(Number);
const browser = await chromium.launch({ channel: "chrome", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
await ctx.addInitScript(() => { try { sessionStorage.setItem("nuab-intro", "1"); } catch {} });
const page = await ctx.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push(e.message));
page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
await page.goto("http://localhost:3000/", { waitUntil: "load", timeout: 120000 });
await page.waitForFunction(() => typeof window.__nuabJourneyGoTo === "function" && window.__nuabJourney, null, { timeout: 120000 });
await page.waitForTimeout(6000);
await page.evaluate(() => { window.__nuabJourney.snap = true; });
if (process.env.HIDE_PANELS) await page.addStyleTag({ content: "[data-panel],[data-postcard]{display:none!important}" });
for (const p of ps) {
  await page.evaluate((p) => window.__nuabJourneyGoTo(p), p);
  await page.waitForTimeout(3500);
  const info = await page.evaluate(() => ({ p: +window.__nuabJourney.progress.toFixed(3), a: window.__nuabJourney.aircraft().position, c: window.__nuabJourney.camera(), proj: window.__nuabJourney.project() }));
  const file = `.dev/shots/${prefix}-${String(Math.round(p * 1000)).padStart(4, "0")}.png`;
  await page.screenshot({ path: file });
  console.log(file, JSON.stringify(info));
}
if (errs.length) console.log("errors:\n" + errs.slice(0, 10).join("\n"));
await browser.close();
