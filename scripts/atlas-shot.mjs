// Dev QA: atlas interactions. usage: node scripts/atlas-shot.mjs <url> <prefix> [w] [h]
import { chromium } from "playwright-core";
const [url = "http://localhost:3000/", prefix = "atlas", w = "1440", h = "900"] = process.argv.slice(2);
const browser = await chromium.launch({ channel: "chrome", args: process.env.SWS ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] : [] });
const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1, isMobile: +w < 700, hasTouch: +w < 700 });
await ctx.addInitScript(() => { try { sessionStorage.setItem("nuab-intro", "1"); } catch {} });
const page = await ctx.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push(e.message));
page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") errs.push(m.type() + ": " + m.text().slice(0, 200)); });
await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.evaluate(() => document.getElementById("atlas")?.scrollIntoView({ block: "start" }));
await page.waitForSelector(".atlas-marker", { timeout: 60000 }).catch(() => errs.push("no markers"));
await page.waitForTimeout(5000);
const mapBox = page.locator("[aria-label='Interactive map of NUAB Tourism destinations']");
await mapBox.evaluate((el) => el.scrollIntoView({ block: "center" }));
await page.evaluate(() => window.scrollBy(0, -140));
await page.waitForTimeout(800);
await page.screenshot({ path: `.dev/shots/${prefix}-1.png` });
console.log("early errors:", errs.join(" || "));
console.log("markers:", await page.locator(".atlas-marker").count());
const hit = await page.locator("li[data-id=agra] button").evaluate((b) => { const r = b.getBoundingClientRect(); const el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return { rect: [r.x, r.y, r.width, r.height], top: el?.outerHTML.slice(0, 160) }; });
console.log("hit test:", JSON.stringify(hit));
// search + select via list
await page.fill("input[type=search]", "taj");
await page.waitForTimeout(900);
const count = await page.locator("ul[aria-label=Destinations] li[data-id]").count();
console.log("results for 'taj':", count, await page.locator("ul[aria-label=Destinations] li[data-id]").evaluateAll((els) => els.map((e) => e.dataset.id)));
await page.fill("input[type=search]", "");
await page.waitForTimeout(500);
await page.locator("li[data-id=agra] button").click();
await page.waitForTimeout(2500);
await page.screenshot({ path: `.dev/shots/${prefix}-2.png` });
const panel = await page.locator("aside[aria-label='Agra details']").innerText().catch(() => "NO PANEL");
console.log("panel:", panel.slice(0, 400).replace(/\n+/g, " | "));
// marker click
await page.locator(".atlas-marker[aria-label^='Mathura']").dispatchEvent("click");
await page.waitForTimeout(2500);
const pressed = await page.locator("li[data-id=mathura] button").getAttribute("aria-pressed");
console.log("list synced to marker (mathura pressed):", pressed, "selected rows:", await page.locator("ul[aria-label=Destinations] button[aria-pressed=true]").evaluateAll((b) => b.map((x) => x.closest("li").dataset.id)));
await page.screenshot({ path: `.dev/shots/${prefix}-3.png` });
// filter: Thailand + beaches
await page.getByRole("radio", { name: "Thailand" }).click();
await page.waitForTimeout(2500);
console.log("thailand results:", await page.locator("ul[aria-label=Destinations] li[data-id]").count());
await page.screenshot({ path: `.dev/shots/${prefix}-4.png` });
console.log(errs.slice(0, 12).join("\n"));
await browser.close();
