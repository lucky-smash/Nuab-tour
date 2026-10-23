// Dev helper: screenshot a URL with the locally installed Chrome (no browser download).
// usage: node scripts/shot.mjs <url> <out.png> [width] [height] [waitTitle|ms] [--reduced] [--mobile] [--eval=js]
import { chromium } from "playwright-core";
const [url, out, w = "1280", h = "760", wait = "ready", ...flags] = process.argv.slice(2);
const browser = await chromium.launch({ channel: "chrome", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, reducedMotion: flags.includes("--reduced") ? "reduce" : "no-preference", isMobile: flags.includes("--mobile"), hasTouch: flags.includes("--mobile"), deviceScaleFactor: 1 });
const page = await ctx.newPage();
const logs = [];
page.on("console", (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto(url, { waitUntil: "load", timeout: 90000 });
if (/^\d+$/.test(wait)) await page.waitForTimeout(+wait);
else await page.waitForFunction((t) => document.title.startsWith(t) || document.title.startsWith("error"), wait, { timeout: 90000 });
for (const f of flags.filter((f) => f.startsWith("--eval="))) {
  const r = await page.evaluate(f.slice(7));
  if (r !== undefined) console.log("eval:", typeof r === "string" ? r : JSON.stringify(r));
  await page.waitForTimeout(900);
}
await page.screenshot({ path: out });
console.log("title:", await page.title());
if (logs.length) console.log(logs.slice(0, 30).join("\n"));
await browser.close();
