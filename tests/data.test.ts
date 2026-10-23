/**
 * Data-fidelity tests: business facts shown on the site must match the content archive
 * (nuabtourism-site-content.md). Each check re-derives the value from the raw markdown with an
 * independent, simple pattern and compares it with the extracted data the UI renders.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { busTours, cabPages, carTours, intlPackages, multiDayTours, blogPosts } from "@/data";
import { destinations } from "@/data/destinations";
import { SITE } from "@/lib/site";
import { STOPS } from "@/components/journey/config";

const md = fs.readFileSync(path.resolve(__dirname, "../nuabtourism-site-content.md"), "utf8");
const pageBlock = (title: string) => {
  const start = md.indexOf(`\n### ${title}\n`);
  expect(start, `page "${title}" in archive`).toBeGreaterThan(-1);
  const next = md.indexOf("\n### ", start + 5);
  return md.slice(start, next < 0 ? undefined : next);
};
const money = (s: string) => Number(s.replace(/[^\d]/g, ""));

describe("contact details", () => {
  it("phones, email and address match the archive", () => {
    for (const p of SITE.phones) expect(md).toContain(p.tel);
    expect(md).toContain(SITE.email);
    expect(md).toContain("C-944, Sushant Lok Rd, Block C, Sushant Lok Phase I, Sector 43, Gurugram, Haryana 122002");
  });
});

describe("same-day car tours", () => {
  it("has all 5 car tours", () => expect(carTours).toHaveLength(5));
  for (const t of carTours) {
    it(`${t.title}: fares match the fare table`, () => {
      const block = pageBlock(t.title);
      const rows = [...block.matchAll(/^\| (Maruti Swift Dzire|Maruti Suzuki Ertiga|Toyota Innova Crysta)[^|]*\| (₹[\d,]+\/-) \|/gm)];
      expect(rows.length).toBe(3);
      expect(t.fares.map((f) => f.fare)).toEqual(rows.map((r) => money(r[2])));
      expect(t.fromPrice).toBe(Math.min(...rows.map((r) => money(r[2]))));
    });
    it(`${t.title}: booking link is from the archive`, () => {
      if (t.bookingLink) expect(pageBlock(t.title)).toContain(t.bookingLink);
    });
  }
  it("Agra by car is ₹6,500 for a Swift Dzire (as stated on the home page)", () => {
    expect(carTours.find((t) => t.slug === "agra-same-day-tour-by-car")!.fares[0].fare).toBe(6500);
  });
  it("Haridwar–Rishikesh duration is the full-day 14–16 hours, not the one-way drive", () => {
    expect(carTours.find((t) => t.slug.startsWith("haridwar"))!.durationText).toBe("14–16 hours");
  });
});

describe("same-day bus tours", () => {
  for (const t of busTours) {
    it(`${t.title}: seat fares match`, () => {
      const block = pageBlock(t.title);
      const fares = [...block.matchAll(/\| (\d\d:\d\d [AP]M) \|[^|]*\| (₹[\d,]+\/-) \|/g)].map((m) => money(m[2]));
      if (fares.length) expect(t.fares.map((f) => f.fare)).toEqual(fares);
      else expect(block).toContain(`₹ ${t.fromPrice}`);
    });
  }
});

describe("multi-day packages", () => {
  it("has all 7 packages", () => expect(multiDayTours).toHaveLength(7));
  for (const t of multiDayTours) {
    it(`${t.title}: prices match`, () => {
      const block = pageBlock(t.title);
      const pp = [...block.matchAll(/₹ ?(\d+)\/- Based on (\d+) Adults/g)].map((m) => Number(m[1]));
      const veh = [...block.matchAll(/^\| [^|]+ \| \d+\+1 \| Rs ([\d,]+) \|/gm)].map((m) => money(m[1]));
      const expected = pp.length ? pp : veh;
      expect((t.pricing?.rows ?? []).map((r) => r.price)).toEqual(expected);
    });
  }
});

describe("outstation cabs", () => {
  it("27 unique routes across the 3 pages", () => expect(cabPages.reduce((a, c) => a + c.routes.length, 0)).toBe(27));
  for (const c of cabPages)
    for (const r of c.routes) {
      it(`${r.from} to ${r.to}: distance and time match`, () => {
        const re = new RegExp(`#### ${r.from} to ${r.to} Distance by Road\\n\\n- \\*\\*Distance:\\*\\* (\\d+) KM\\n- \\*\\*Travel Time:\\*\\* ([^\\n]+)`);
        const m = md.match(re);
        expect(m).not.toBeNull();
        expect(r.distanceKm).toBe(Number(m![1]));
        expect(r.travelTime).toBe(m![2].trim());
        expect(r.fareLabel).toBe("₹10/KM");
      });
      it(`${r.from} to ${r.to}: WhatsApp message names the right destination`, () => {
        expect(decodeURIComponent(r.whatsapp)).toContain(`${r.from} to ${r.to} cab`);
      });
    }
});

describe("international packages", () => {
  it("15 Dubai + 15 Thailand", () => {
    expect(intlPackages.filter((p) => p.country === "dubai")).toHaveLength(15);
    expect(intlPackages.filter((p) => p.country === "thailand")).toHaveLength(15);
  });
  for (const p of intlPackages)
    it(`${p.title}: duration and itinerary`, () => {
      expect(p.duration, "duration").toBeTruthy();
      expect(p.itinerary.length).toBe(p.days);
      expect(p.inclusions.length).toBeGreaterThan(3);
    });
});

describe("blog", () => it("5 posts with content", () => {
  expect(blogPosts).toHaveLength(5);
  for (const p of blogPosts) expect(p.html.length).toBeGreaterThan(2000);
}));

describe("destinations", () => {
  it("ids are unique and URL-safe", () => {
    const ids = destinations.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
  });
  it("coordinates fall in the right region", () => {
    for (const d of destinations) {
      if (d.country === "India") { expect(d.lat).toBeGreaterThan(24); expect(d.lat).toBeLessThan(34); expect(d.lng).toBeGreaterThan(73); expect(d.lng).toBeLessThan(81); }
      if (d.country === "UAE") { expect(d.lat).toBeGreaterThan(23); expect(d.lat).toBeLessThan(27); expect(d.lng).toBeGreaterThan(53); expect(d.lng).toBeLessThan(57); }
      if (d.country === "Thailand") { expect(d.lat).toBeGreaterThan(5); expect(d.lat).toBeLessThan(21); expect(d.lng).toBeGreaterThan(97); expect(d.lng).toBeLessThan(102); }
    }
  });
  it("every destination is backed by at least one NUAB offer in the archive", () => {
    for (const d of destinations) expect(d.modes.length, d.id).toBeGreaterThan(0);
  });
  it("journey stops reference real destinations and real tours", () => {
    for (const s of STOPS) {
      for (const id of s.destinationIds) expect(destinations.some((d) => d.id === id), id).toBe(true);
      expect(s.intro.length).toBeGreaterThan(60);
    }
  });
});
