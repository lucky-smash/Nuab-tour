// Dev QA: full-page screenshots of several routes, downscaled into one contact sheet.
import { chromium } from "playwright-core";
import sharp from "sharp";
const routes = process.argv.slice(2);
const browser = await chromium.launch({ channel: "chrome" });
const ctx = await browser.newContext({ viewport: { width: 1366, height: 860 }, deviceScaleFactor: 1, reducedMotion: process.env.REDUCED ? "reduce" : "no-preference" });
await ctx.addInitScript(() => { try { sessionStorage.setItem("nuab-intro", "1"); } catch {} });
const out = [];
for (const r of routes) {
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 160)); });
  await page.goto("http://localhost:3000" + r, { waitUntil: "load", timeout: 180000 });
  await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 700) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); } window.scrollTo(0, 0); });
  await page.waitForTimeout(800);
  const file = `.dev/shots/page-${r.replace(/[^a-z0-9]+/gi, "_") || "root"}.png`;
  await page.screenshot({ path: file, fullPage: true });
  out.push(file);
  console.log(r, (await page.evaluate(() => document.body.scrollHeight)), errs.length ? "ERR: " + errs.join(" | ") : "");
  await page.close();
}
const W = 420;
const imgs = await Promise.all(out.map(async (f) => { const b = await sharp(f).resize({ width: W }).toBuffer(); const m = await sharp(b).metadata(); return { b, h: Math.min(m.height, 2600) }; }));
const H = Math.max(...imgs.map((i) => i.h));
await sharp({ create: { width: W * imgs.length + 10 * (imgs.length - 1), height: H, channels: 3, background: "#ccc" } })
  .composite(await Promise.all(imgs.map(async (i, k) => ({ input: await sharp(i.b).extract({ left: 0, top: 0, width: W, height: i.h }).toBuffer(), left: k * (W + 10), top: 0 }))))
  .png().toFile(".dev/shots/pages-sheet.png");
await browser.close();
