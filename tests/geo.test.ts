/**
 * India must be drawn with its official boundary everywhere on the site (India point-of-view
 * dataset, scripts/build-geo.mjs). These checks guard against regressing to de facto lines.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import india from "@/data/geo/india.json";
import { destinations } from "@/data/destinations";

const rings = india.rings as number[][][];
const inside = (lat: number, lng: number) => {
  let c = false;
  for (const r of rings)
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const [xi, yi] = r[i], [xj, yj] = r[j];
      if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) c = !c;
    }
  return c;
};

describe("India outline (official boundary)", () => {
  it.each([
    ["Srinagar", 34.08, 74.8],
    ["Leh", 34.15, 77.58],
    ["Gilgit", 35.92, 74.3],
    ["Muzaffarabad", 34.37, 73.47],
    ["Aksai Chin", 35.2, 79.5],
    ["Tawang", 27.59, 91.86],
    ["Delhi", 28.61, 77.21],
    ["Kanyakumari", 8.09, 77.54],
  ])("includes %s", (_n, lat, lng) => expect(inside(lat, lng)).toBe(true));

  it.each([
    ["Lahore", 31.55, 74.34],
    ["Kathmandu", 27.72, 85.32],
    ["Dhaka", 23.81, 90.41],
    ["Colombo", 6.93, 79.86],
  ])("excludes %s", (_n, lat, lng) => expect(inside(lat, lng)).toBe(false));

  it("reaches the northern tip of Ladakh (~37°N)", () => {
    expect(india.bbox[3]).toBeGreaterThan(36.9);
  });

  it("every Indian destination lies inside India", () => {
    for (const d of destinations.filter((x) => x.country === "India")) expect(inside(d.lat, d.lng), d.id).toBe(true);
  });

  it("the 3D atlas labels neighbouring countries outside India", () => {
    const src = fs.readFileSync(path.resolve(__dirname, "../src/components/journey/Environment.tsx"), "utf8");
    const labels = [...src.matchAll(/label\("([^"]+)", ([\d.]+), ([\d.]+)\)/g)];
    expect(labels.length).toBeGreaterThanOrEqual(3);
    for (const [, name, lat, lng] of labels) expect(inside(Number(lat), Number(lng)), name).toBe(false);
  });

  it("the live map uses the India point-of-view borders", () => {
    const geo = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../public/geo/borders-ind.geojson"), "utf8"));
    expect(geo.features.some((f: { properties: { india: boolean } }) => f.properties.india)).toBe(true);
  });
});
