/**
 * Extracts structured business data from nuabtourism-site-content.md (the archive of the
 * live WordPress site) into src/data/generated/*.json.
 *
 * Nothing here invents data: every price, duration, place, inclusion and link is read from the
 * archive. Remote image URLs are rewritten to local /media/wp/... paths that
 * scripts/fetch-assets.mjs downloads.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { marked } from "marked";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "nuabtourism-site-content.md");
const OUT = path.join(ROOT, "src", "data", "generated");
fs.mkdirSync(OUT, { recursive: true });

const WP_PREFIX = "https://nuabtourism.in/wp-content/uploads/";
const localMedia = (url) => (url && url.startsWith(WP_PREFIX) ? "/media/wp/" + url.slice(WP_PREFIX.length) : url);
const rewriteMediaInText = (s) => s.replaceAll(WP_PREFIX, "/media/wp/");

const text = fs.readFileSync(SRC, "utf8");
const lines = text.split(/\r?\n/);

// ---------------------------------------------------------------------------
// 1. Split into sections (## N. ...) and pages (### ...)
// ---------------------------------------------------------------------------
const sections = [];
let cur = null;
let curPage = null;
for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  const m2 = /^## (\d+)\. (.+)$/.exec(l);
  if (m2) {
    cur = { num: Number(m2[1]), title: m2[2].trim(), preamble: [], pages: [] };
    curPage = null;
    sections.push(cur);
    continue;
  }
  if (!cur) continue;
  const m3 = /^### (.+)$/.exec(l);
  if (m3) {
    curPage = { title: m3[1].trim(), lines: [] };
    cur.pages.push(curPage);
    continue;
  }
  (curPage ? curPage.lines : cur.preamble).push(l);
}

// ---------------------------------------------------------------------------
// 2. Generic block parser
// ---------------------------------------------------------------------------
const LINK_RE = /^\[([^\]]*)\]\(([^)\s]+)\)$/;
const IMG_RE = /^!\[([^\]]*)\]\(([^)\s]+)\)$/;
const LINKED_IMG_RE = /^\[!\[([^\]]*)\]\(([^)\s]+)\)\]\(([^)\s]+)\)$/;

function parseMeta(pageLines) {
  const meta = {};
  let i = 0;
  while (i < pageLines.length && pageLines[i].trim() === "") i++;
  while (i < pageLines.length) {
    const m = /^- \*\*([^*]+):\*\* (.*)$/.exec(pageLines[i]);
    if (!m) break;
    const key = m[1].trim().toLowerCase();
    const val = m[2].trim();
    if (key === "url") meta.url = val;
    else if (key === "seo title") meta.seoTitle = val;
    else if (key === "meta description") meta.metaDescription = val;
    else if (key.startsWith("last modified")) meta.lastModified = val;
    else if (key === "duration") meta.duration = val;
    else if (key === "published") meta.published = val;
    i++;
  }
  return { meta, rest: pageLines.slice(i) };
}

function parseBlocks(bodyLines) {
  const blocks = [];
  let i = 0;
  const flushPara = (buf) => {
    if (!buf.length) return;
    const joined = buf.join("\n").trim();
    if (!joined) return;
    let m;
    if ((m = LINKED_IMG_RE.exec(joined))) blocks.push({ type: "image", alt: m[1], src: localMedia(m[2]), href: localMedia(m[3]) });
    else if ((m = IMG_RE.exec(joined))) blocks.push({ type: "image", alt: m[1], src: localMedia(m[2]) });
    else if ((m = LINK_RE.exec(joined))) blocks.push({ type: "link", text: m[1], href: m[2] });
    else blocks.push({ type: "paragraph", text: rewriteMediaInText(joined) });
  };
  while (i < bodyLines.length) {
    const l = bodyLines[i];
    if (l.trim() === "") { i++; continue; }
    let m;
    if ((m = /^(#{1,6}) (.+)$/.exec(l))) {
      let t = m[2].trim();
      let href;
      const lm = LINK_RE.exec(t);
      if (lm) { t = lm[1]; href = lm[2]; }
      blocks.push({ type: "heading", level: m[1].length, text: t, ...(href ? { href } : {}) });
      i++; continue;
    }
    if (l.startsWith("|")) {
      const rows = [];
      while (i < bodyLines.length && bodyLines[i].startsWith("|")) {
        rows.push(bodyLines[i].slice(1).replace(/\|\s*$/, "").split("|").map((c) => c.trim()));
        i++;
      }
      const header = rows[0];
      const body = rows.slice(1).filter((r) => !r.every((c) => /^-+$/.test(c)));
      blocks.push({ type: "table", header, rows: body });
      continue;
    }
    if (/^(- |\d+\. )/.test(l)) {
      const items = [];
      while (i < bodyLines.length && (/^(- |\d+\. )/.test(bodyLines[i]) || /^\s{2,}\S/.test(bodyLines[i]))) {
        if (/^\s{2,}\S/.test(bodyLines[i]) && items.length) {
          // indented continuation lines in the archive are really separate items
          items.push(bodyLines[i].trim());
        } else {
          items.push(bodyLines[i].replace(/^(- |\d+\. )/, "").trim());
        }
        i++;
      }
      blocks.push({ type: "list", items: items.map(rewriteMediaInText) });
      continue;
    }
    const buf = [];
    while (i < bodyLines.length && bodyLines[i].trim() !== "" && !/^(#{1,6} |\||- |\d+\. )/.test(bodyLines[i])) {
      buf.push(bodyLines[i]);
      i++;
    }
    flushPara(buf);
  }
  return blocks;
}

const slugFromUrl = (url) => {
  const u = url.replace(/\/+$/, "");
  return u.slice(u.lastIndexOf("/") + 1);
};
const pathFromUrl = (url) => new URL(url).pathname.replace(/\/?$/, "/");

function pageRecord(page) {
  const { meta, rest } = parseMeta(page.lines);
  const blocks = parseBlocks(rest);
  return { title: page.title, ...meta, slug: meta.url ? slugFromUrl(meta.url) : undefined, path: meta.url ? pathFromUrl(meta.url) : undefined, blocks, rawBody: rest.join("\n") };
}

// Helpers over blocks --------------------------------------------------------
const findHeading = (blocks, re, from = 0) => blocks.findIndex((b, idx) => idx >= from && b.type === "heading" && re.test(b.text));
const nextHeadingIdx = (blocks, from, maxLevel = 6) => {
  for (let i = from; i < blocks.length; i++) if (blocks[i].type === "heading" && blocks[i].level <= maxLevel) return i;
  return blocks.length;
};
const sliceSection = (blocks, re, level = 4) => {
  const h = findHeading(blocks, re);
  if (h < 0) return [];
  return blocks.slice(h + 1, nextHeadingIdx(blocks, h + 1, level));
};
const firstOf = (blocks, type) => blocks.find((b) => b.type === type);

function parseFaqs(blocks) {
  const h = findHeading(blocks, /^FAQs?$/i);
  if (h < 0) return [];
  const sec = blocks.slice(h + 1);
  const faqs = [];
  for (let i = 0; i < sec.length; i++) {
    const b = sec[i];
    if (b.type === "heading") {
      const q = b.text.replace(/^\d+\.\s*/, "").trim();
      const a = sec[i + 1];
      if (a && a.type === "paragraph") { faqs.push({ q, a: a.text }); i++; }
    } else if (b.type === "paragraph" && sec[i + 1] && sec[i + 1].type === "paragraph") {
      faqs.push({ q: b.text, a: sec[i + 1].text }); i++;
    }
  }
  return faqs;
}

function parseAmenityTable(blocks, headerRe) {
  const t = blocks.find((b) => b.type === "table" && headerRe.test(b.header[1] || ""));
  return t ? t.rows.map((r) => r[0]) : [];
}

const parseMoney = (s) => {
  const m = /([\d,]+)/.exec(s.replace(/\s/g, ""));
  return m ? Number(m[1].replace(/,/g, "")) : null;
};

// ---------------------------------------------------------------------------
// 3. Extractors
// ---------------------------------------------------------------------------
const bySection = Object.fromEntries(sections.map((s) => [s.num, s]));
const allPages = [];

// --- Home -------------------------------------------------------------------
function extractHome() {
  const page = pageRecord(bySection[2].pages[0]);
  const b = page.blocks;
  // Hero slides: heading + paragraph (+ "Enquire Now") groups until "WHY BOOK"
  const whyIdx = findHeading(b, /WHY BOOK/i);
  const slides = [];
  for (let i = 0; i < whyIdx; i++) {
    if (b[i].type === "heading" && b[i + 1]?.type === "paragraph") {
      const title = b[i].text.replace("Inernational", "International");
      if (!slides.some((s) => s.title === title)) slides.push({ title, text: b[i + 1].text });
    }
  }
  // Why book cards
  const whyBlocks = b.slice(whyIdx + 1, findHeading(b, /Built in Gurugram/i));
  const whyBook = [];
  for (let i = 0; i < whyBlocks.length; i++) if (whyBlocks[i].type === "heading" && whyBlocks[i + 1]?.type === "paragraph") whyBook.push({ title: whyBlocks[i].text, text: whyBlocks[i + 1].text });
  // About teaser
  const aboutIdx = findHeading(b, /Built in Gurugram/i);
  const aboutParas = b.slice(aboutIdx + 1).filter((x) => x.type === "paragraph").slice(0, 2).map((x) => x.text);
  // Golden triangle teaser paragraph
  const gtIdx = findHeading(b, /^Golden Triangle Tour Packages$/i);
  const goldenTriangleIntro = b[gtIdx + 1]?.type === "paragraph" ? b[gtIdx + 1].text : "";
  const featured = [];
  for (let i = gtIdx; i < findHeading(b, /^Car Booking$/i); i++) {
    if (b[i].type === "heading" && b[i].href) {
      const img = b.slice(Math.max(gtIdx, i - 2), i).find((x) => x.type === "image");
      featured.push({ title: b[i].text, href: pathFromUrl(b[i].href), image: img?.src });
    }
  }
  // Car hire + trust
  const carIdx = findHeading(b, /^Full Car Hire$/i);
  const carHireText = b[carIdx + 1]?.text || "";
  const carHire = ["Intercity Hire", "Corporate Retreat", "Group Pricing", "Wedding Hire"];
  const trust = [
    { label: "Trusted by over 8m+ happy travellers", icon: "users" },
    { label: "Lowest price guarantee", icon: "badge" },
    { label: "24×7 customer support", icon: "headset" },
    { label: "5000+ verified traveller reviews", icon: "star" },
  ];
  // Testimonials
  const tIdx = findHeading(b, /^Luxury Travel$/i);
  const tBlocks = b.slice(tIdx + 1, findHeading(b, /^FAQs$/i));
  const testimonials = [];
  for (let i = 0; i < tBlocks.length; i++) {
    const p = tBlocks[i];
    const n = tBlocks[i + 1];
    if (p?.type === "paragraph" && n?.type === "paragraph" && /—/.test(n.text) && n.text.length < 60) {
      const [name, title] = n.text.split("—").map((s) => s.trim());
      testimonials.push({ quote: p.text, name, title });
      i++;
    }
  }
  const tagline = tBlocks.find((x) => x.type === "paragraph" && x.text.length < 60 && !/—/.test(x.text))?.text || "";
  return { ...pageMeta(page), slides, whyBook, aboutParas, goldenTriangleIntro, featured, carHireText, carHire, trust, tagline, testimonials, faqs: parseFaqs(b) };
}

function pageMeta(p) {
  return { title: p.title, url: p.url, path: p.path, slug: p.slug, seoTitle: p.seoTitle, metaDescription: p.metaDescription, lastModified: p.lastModified };
}

// --- About / Contact / Privacy / Thank you ----------------------------------
function extractAbout() {
  const page = pageRecord(bySection[3].pages[0]);
  const b = page.blocks;
  const intro = firstOf(b, "paragraph")?.text;
  const image = firstOf(b, "image")?.src;
  const paras = sliceSection(b, /^About NUAB Tourism$/i, 5).filter((x) => x.type === "paragraph").map((x) => x.text);
  const mission = sliceSection(b, /Our Mission/i, 5).find((x) => x.type === "paragraph")?.text;
  const vision = sliceSection(b, /Our Vision/i, 5).find((x) => x.type === "paragraph")?.text;
  const letsTravel = sliceSection(b, /Let’s Travel Together/i, 4).find((x) => x.type === "paragraph")?.text;
  return { ...pageMeta(page), intro, image, letsTravel, paras, mission, vision };
}
function extractContact() {
  const page = pageRecord(bySection[4].pages[0]);
  const b = page.blocks;
  return { ...pageMeta(page), intro: firstOf(b, "paragraph")?.text, getInTouch: sliceSection(b, /^Get In Touch$/i, 4).find((x) => x.type === "paragraph")?.text, mapEmbed: b.find((x) => x.type === "link" && /maps\.google/.test(x.href))?.href };
}
function extractOther() {
  const sec = bySection[13];
  const privacy = pageRecord(sec.pages.find((p) => /Privacy/i.test(p.title)));
  const thank = pageRecord(sec.pages.find((p) => /thank/i.test(p.title)));
  const sitemap = pageRecord(sec.pages.find((p) => /Sitemap/i.test(p.title)));
  // Privacy: convert body (after meta) to HTML; demote #### to h2/h3 for a clean hierarchy
  const body = privacy.rawBody.replace(/^#### (\d+\.)/gm, "## $1").replace(/^#### (?!Privacy Policy)/gm, "### ").replace(/^#### Privacy Policy\s*$/m, "");
  return {
    privacy: { ...pageMeta(privacy), html: marked.parse(rewriteMediaInText(body)) },
    thankYou: { ...pageMeta(thank), text: thank.blocks.find((x) => x.type === "paragraph")?.text, image: firstOf(thank.blocks, "image")?.src },
    sitemapPage: pageMeta(sitemap),
  };
}

// --- Same-day car & bus tours ----------------------------------------------
function extractDayTour(page, mode) {
  const b = page.blocks;
  const tagline = firstOf(b, "paragraph")?.text;
  const introH = b.findIndex((x) => x.type === "heading" && x.level === 4 && !/^₹/.test(x.text));
  const introParas = [];
  for (let i = introH + 1; i < b.length && b[i].type !== "heading"; i++) if (b[i].type === "paragraph") introParas.push(b[i].text);
  const bookingLink = b.find((x) => x.type === "link" && /booking\.nuabtourism/.test(x.href))?.href;
  const placesSec = sliceSection(b, /^Places Covered/i);
  let places = (placesSec.find((x) => x.type === "list")?.items || [])
    .filter((p) => !/^Looking for/i.test(p))
    .map((p) => (p.length > 60 && p.includes(" — ") ? p.split(" — ")[0].trim() : p));
  let placesCorrected = false;
  const notes = placesSec.filter((x) => x.type === "paragraph" && /^(Note|Fare includes)/i.test(x.text)).map((x) => x.text);
  // Attraction write-ups: heading + paragraph(s)/list between places and "Our ... Services" / "sightseeing by private car"
  const svcIdx = findHeading(b, /(Services|sightseeing by private car)\s*:?-?$/i);
  const start = findHeading(b, /^Places Covered/i) >= 0 ? nextHeadingIdx(b, findHeading(b, /^Places Covered/i) + 1) : introH + 1;
  const attractions = [];
  for (let i = start; i < (svcIdx < 0 ? b.length : svcIdx); i++) {
    if (b[i].type === "heading" && b[i].level === 4) {
      const name = b[i].text.replace(/^\d+\.\s*/, "").replace(/:$/, "").trim();
      const body = [];
      for (let j = i + 1; j < b.length && b[j].type !== "heading"; j++) {
        if (b[j].type === "paragraph") body.push(b[j].text);
        if (b[j].type === "list") body.push(...b[j].items);
      }
      if (body.length) attractions.push({ name, text: body.join(" ") });
    }
  }
  // Source quirk: several pages carry the Agra page's "Places Covered" list although their own
  // attraction write-ups describe another city. Use the page's own attractions instead.
  const cityOf = page.slug.split("-")[0];
  if (attractions.length && (!places.length || (cityOf !== "agra" && places.some((p) => /Taj Mahal/i.test(p))))) {
    if (places.length) placesCorrected = true;
    places = attractions.map((a) => a.name);
  }
  const services = svcIdx >= 0 ? b.slice(svcIdx + 1, nextHeadingIdx(b, svcIdx + 1)).find((x) => x.type === "list")?.items || [] : [];
  const inclusions = parseAmenityTable(b, /Inclusions/i);
  const exclusions = parseAmenityTable(b, /Exclude/i);
  const fareTable = b.find((x) => x.type === "table" && /^(Car|Bus) Type/i.test(x.header[0]));
  let fares = [];
  if (fareTable) {
    fares = fareTable.rows.map((r) => {
      if (mode === "car") {
        const m = /^(.*?)\s*\((.*?)\)\s*$/.exec(r[0]);
        return { vehicle: m ? m[1].trim() : r[0], capacity: m ? m[2].trim() : null, fareLabel: r[1], fare: parseMoney(r[1]), unit: "per vehicle" };
      }
      return { vehicle: r[0], departure: r[1], returnTime: r[2], fareLabel: r[3], fare: parseMoney(r[3]), unit: "per seat" };
    });
  }
  const priceHeading = b.find((x) => x.type === "heading" && /^₹/.test(x.text));
  const fromPrice = fares.length ? Math.min(...fares.map((f) => f.fare).filter(Boolean)) : priceHeading ? parseMoney(priceHeading.text) : null;
  const durationFaq = parseFaqs(b).find((f) => /how long|duration/i.test(f.q));
  let durationText = "Full day";
  if (durationFaq) {
    // pick the widest range ("5–6 hours each way" vs "14–16 hours" for the full tour)
    const ranges = [...durationFaq.a.matchAll(/(\d+)\s*[–-]\s*(\d+)\s*hours/gi)];
    if (ranges.length) {
      const best = ranges.sort((x, y) => Number(y[2]) - Number(x[2]))[0];
      durationText = `${best[1]}–${best[2]} hours`;
    }
  }
  const startFaq = parseFaqs(b).find((f) => /best time to start/i.test(f.q));
  const startTime = startFaq ? /\(around ([^)]+)\)/.exec(startFaq.a)?.[1] || null : null;
  return {
    ...pageMeta(page), kind: "same-day", mode, tagline, introHeading: b[introH]?.text, introParas, bookingLink, places, notes, attractions, services,
    placesCorrected, inclusions, exclusions, fares, fromPrice, fareUnit: mode === "car" ? "per vehicle" : "per seat", durationText, startTime, faqs: parseFaqs(b),
  };
}

// --- Multi-day packages -----------------------------------------------------
function extractMultiDay(page) {
  const b = page.blocks;
  const headline = b.find((x) => x.type === "heading" && x.level === 4 && !/^Special Packages$/i.test(x.text))?.text;
  const introParas = [];
  {
    const hi = b.findIndex((x) => x === b.find((y) => y.type === "heading" && y.level === 4 && !/^Special Packages$/i.test(y.text)));
    // first descriptive heading after the headline (may be the headline itself)
    let i = hi + 1;
    while (i < b.length && introParas.length < 2) {
      if (b[i].type === "paragraph" && b[i].text.length > 80) introParas.push(b[i].text);
      if (b[i].type === "heading" && /Highlights|Itinerary|Day 1/i.test(b[i].text)) break;
      i++;
    }
  }
  const bookingLink = b.find((x) => x.type === "link" && /Book Now/i.test(x.text))?.href;
  const highlights = sliceSection(b, /^Highlights/i).find((x) => x.type === "list")?.items || [];
  // Itinerary days
  const days = [];
  for (let i = 0; i < b.length; i++) {
    const m = b[i].type === "heading" && /^Day\s*(\d+)\s*:\s*(.+)$/i.exec(b[i].text);
    if (!m) continue;
    const stops = [];
    const paras = [];
    const items = [];
    for (let j = i + 1; j < b.length; j++) {
      const x = b[j];
      if (x.type === "heading" && (/^Day\s*\d+/i.test(x.text) || /Price|Restaurants|Temples Covered|Package (Ex|In)clusions|FAQs|Famous Temples|Places to Visit/i.test(x.text))) {
        // "Famous Temples"/"Places to Visit" sub-lists belong to the day but end the paragraph run
        if (/Famous Temples|Places to Visit/i.test(x.text)) {
          const subItems = [];
          for (let k = j + 1; k < b.length && !(b[k].type === "heading" && /^Day|Package|FAQs|Price/i.test(b[k].text)); k++) {
            if (b[k].type === "paragraph") subItems.push(b[k].text.replace(/^\d+:-\s*/, "").replace(/\.$/, ""));
            if (b[k].type === "list") subItems.push(...b[k].items);
          }
          stops.push({ title: x.text, items: subItems });
          j += subItems.length;
          continue;
        }
        break;
      }
      if (x.type === "heading") { stops.push({ title: x.text.replace(/:$/, ""), items: [] }); continue; }
      if (x.type === "paragraph") { if (stops.length && !stops[stops.length - 1].text) stops[stops.length - 1].text = x.text; else paras.push(x.text); }
      if (x.type === "list") { if (stops.length) stops[stops.length - 1].items.push(...x.items); else items.push(...x.items); }
    }
    days.push({ day: Number(m[1]), title: m[2].trim(), paras, items, stops });
  }
  // Pricing
  let pricing = null;
  const ppTable = b.find((x) => x.type === "table" && /Price Per Person/i.test(x.header[0]));
  const vehTable = b.find((x) => x.type === "table" && /Mode of Travel/i.test(x.header[0]));
  if (ppTable) {
    const rows = ppTable.rows.filter((r) => /₹/.test(r[1] || ""));
    pricing = {
      basis: "per person",
      note: ppTable.rows.find((r) => /^\*/.test(r[0]))?.[0].replace(/^\*/, "").trim() || null,
      rows: rows.map((r) => {
        const m = /₹\s*([\d,]+)\/-\s*Based on (\d+) Adults Travelling Together\s*\((.*?)\)/i.exec(r[1]);
        return { label: r[1], price: m ? Number(m[1].replace(/,/g, "")) : parseMoney(r[1]), adults: m ? Number(m[2]) : null, vehicle: m ? m[3] : null };
      }),
    };
  } else if (vehTable) {
    pricing = { basis: "per vehicle", note: null, rows: vehTable.rows.map((r) => ({ label: `${r[0]} (${r[1]})`, vehicle: r[0], seating: r[1], price: parseMoney(r[2]) })) };
  }
  const fromPrice = pricing ? Math.min(...pricing.rows.map((r) => r.price).filter(Boolean)) : null;
  // Temples covered (sequence of headings)
  const tIdx = findHeading(b, /^Temples Covered/i);
  const temples = [];
  if (tIdx >= 0) for (let i = tIdx + 1; i < b.length; i++) { const x = b[i]; if (x.type === "heading" && /Package (Ex|In)clusions|FAQs/i.test(x.text)) break; if (x.type === "heading" && !/^Temples Covered/i.test(x.text) && !temples.includes(x.text)) temples.push(x.text); }
  const inclusions = sliceSection(b, /^Package Inclusions$/i).find((x) => x.type === "list")?.items || [];
  const exclusions = sliceSection(b, /^Package Exclusions$/i).find((x) => x.type === "list")?.items || [];
  const restaurants = sliceSection(b, /^Restaurants$/i).filter((x) => x.type === "paragraph").map((x) => x.text).filter((t) => / - /.test(t));
  const nights = /(\d+)\s*Night/i.exec(page.title) ? Number(/(\d+)\s*Night/i.exec(page.title)[1]) : null;
  const daysCount = /(\d+)\s*Days?/i.exec(page.title) ? Number(/(\d+)\s*Days?/i.exec(page.title)[1]) : days.length;
  return { ...pageMeta(page), kind: "multi-day", headline, introParas, bookingLink, highlights, itinerary: days, pricing, fromPrice, temples, inclusions, exclusions, restaurants, nights: nights ?? daysCount - 1, days: daysCount, durationText: `${nights ?? daysCount - 1} Night${(nights ?? daysCount - 1) === 1 ? "" : "s"} / ${daysCount} Days`, faqs: parseFaqs(b) };
}

// --- Outstation cabs --------------------------------------------------------
function extractCabPage(page) {
  const b = page.blocks;
  const intro = firstOf(b, "paragraph")?.text;
  const routes = [];
  for (let i = 0; i < b.length; i++) {
    const m = b[i].type === "heading" && b[i].level === 4 && /^(.+?) to (.+?) Distance by Road$/i.exec(b[i].text);
    if (!m) continue;
    const from = m[1].trim();
    const to = m[2].trim();
    if (routes.some((r) => r.from === from && r.to === to)) continue; // the Himachal page repeats two cards
    const list = b[i + 1]?.type === "list" ? b[i + 1].items : [];
    const stat = (re) => list.find((x) => re.test(x))?.replace(/^\*\*[^*]+:\*\*\s*/, "").trim() || null;
    const paras = [];
    let whatsapp = null;
    let j = i + (list.length ? 2 : 1);
    for (; j < b.length && b[j].type !== "heading"; j++) {
      if (b[j].type === "paragraph") paras.push(b[j].text);
      if (b[j].type === "link" && /wa\.me/.test(b[j].href)) whatsapp = b[j].href;
    }
    let routeVia = null;
    const waypoints = [];
    if (b[j]?.type === "heading" && /Route via/i.test(b[j].text)) {
      routeVia = /Route via (.+)$/i.exec(b[j].text)?.[1] || null;
      for (let k = j + 1; k < b.length && b[k].type !== "heading"; k++) if (b[k].type === "paragraph" && b[k].text.length < 40) waypoints.push(b[k].text);
    }
    const km = stat(/Distance/i);
    const time = stat(/Travel Time/i);
    const fare = stat(/Taxi Fare/i);
    const service = stat(/Service/i);
    // The archive's WhatsApp links all carry a copy-pasted "Bir Billing" message; the number is
    // kept and the destination name corrected so the prefilled message matches the card.
    const phone = whatsapp ? /wa\.me\/(\+?\d+)/.exec(whatsapp)?.[1] : "+919311229795";
    const whatsappFixed = `https://wa.me/${phone}?text=${encodeURIComponent(`Hello I want to book a ${from} to ${to} cab.`)}`;
    routes.push({ id: `${from}-${to}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"), from, to, distanceKm: km ? Number(/(\d+)/.exec(km)[1]) : null, distanceLabel: km, travelTime: time, fareLabel: fare, service, paras, routeVia, waypoints, whatsapp: whatsappFixed, whatsappOriginal: whatsapp });
  }
  return { ...pageMeta(page), intro, routes };
}

// --- International packages -------------------------------------------------
function extractIntlLanding(page) {
  const b = page.blocks;
  const heroH = b.find((x) => x.type === "heading" && x.level === 4);
  const heroText = b[b.indexOf(heroH) + 1]?.text;
  const heroImage = firstOf(b, "image")?.src;
  const aboutIdx = b.findIndex((x) => x.type === "heading" && /Explore the Best of|Tropical Paradise/i.test(x.text));
  const aboutParas = b.slice(aboutIdx + 1, findHeading(b, /^Most Popular/i)).filter((x) => x.type === "paragraph").map((x) => x.text);
  const cards = [];
  const popIdx = findHeading(b, /^Most Popular/i);
  for (let i = popIdx + 1; i < findHeading(b, /^FAQs$/i); i++) {
    if (b[i].type === "heading") {
      const img = b[i - 1]?.type === "image" ? b[i - 1].src : null;
      const dur = b[i + 1]?.type === "paragraph" ? b[i + 1].text : null;
      const link = b.slice(i, i + 5).find((x) => x.type === "link" && /Book Now/i.test(x.text))?.href;
      cards.push({ title: b[i].text, image: img, duration: dur, slug: link ? slugFromUrl(link) : null });
    }
  }
  return { ...pageMeta(page), heroHeading: heroH?.text, heroText, heroImage, aboutParas, cards, faqs: parseFaqs(b) };
}

function extractIntlPackage(page, country, landing, durationTable) {
  const b = page.blocks;
  const sec = (re) => {
    const h = b.findIndex((x) => x.type === "heading" && x.level === 5 && re.test(x.text));
    if (h < 0) return [];
    return b.slice(h + 1, nextHeadingIdx(b, h + 1, 5));
  };
  // Overview: UPPERCASE place-name line(s) followed by text (sometimes same paragraph)
  const overview = [];
  const ovParas = sec(/^Overview$/i).filter((x) => x.type === "paragraph");
  for (let i = 0; i < ovParas.length; i++) {
    const t = ovParas[i].text;
    const ls = t.split("\n");
    if (ls[0] === ls[0].toUpperCase() && ls[0].length < 60 && ls.length > 1) overview.push({ place: titleCase(ls[0]), text: ls.slice(1).join(" ") });
    else if (t === t.toUpperCase() && t.length < 60 && ovParas[i + 1]) { overview.push({ place: titleCase(t), text: ovParas[i + 1].text }); i++; }
    else if (ls.length > 1 && ls[0].length < 60 && !/[.!?]$/.test(ls[0])) overview.push({ place: null, heading: titleCase(ls[0].replace(/^PLACES TO VISIT IN \w+/i, "").trim() || ls[0]), text: ls.slice(1).join(" ") });
    else overview.push({ place: null, text: t });
  }
  const days = [];
  let itineraryNote = null;
  for (const p of sec(/^Itinerary$/i).filter((x) => x.type === "paragraph")) {
    const ls = p.text.split("\n");
    const m = /^DAY\s*0?(\d+)\s*[:\-–]\s*(.+)$/i.exec(ls[0]);
    if (m) days.push({ day: Number(m[1]), title: titleCase(m[2].trim()), text: ls.slice(1).join(" ") });
    else if (/^Note:/i.test(p.text)) itineraryNote = p.text.replace(/^Note:\s*/i, "");
    else if (days.length) days[days.length - 1].text += " " + p.text;
  }
  const listLines = (re) => {
    const paras = sec(re).filter((x) => x.type === "paragraph");
    const out = [];
    for (const p of paras) for (const l of p.text.split("\n")) { const s = l.trim(); if (s && !/INCLUDES:|EXCLUDES:/i.test(s)) out.push(s); }
    return out;
  };
  const inclusions = listLines(/^Inclusion$/i);
  let exclusions = listLines(/^Exclusion$/i);
  let exclusionsMissing = false;
  if (!exclusions.some((l) => /personal nature|meals|visa|porterage|services not mentioned/i.test(l))) { exclusions = []; exclusionsMissing = true; }
  const card = landing.cards.find((c) => c.slug === page.slug);
  const durationFromTable = durationTable.get(page.slug);
  let duration = page.duration || (durationFromTable && durationFromTable !== "—" ? durationFromTable : null) || card?.duration || null;
  if (!duration) {
    const faqHit = landing.faqs.map((f) => f.a).join(" ").match(new RegExp(`${escapeRe(page.title)}\\s*\\((\\d+)N/(\\d+)D\\)`, "i"));
    if (faqHit) duration = `0${faqHit[1]} Nights / 0${faqHit[2]} Days`.replace(/0(\d\d)/g, "$1");
  }
  const dm = duration ? /(\d+)\s*Nights?\s*[\/–-]\s*(\d+)\s*Days?/i.exec(duration) : null;
  return { ...pageMeta(page), country, duration, nights: dm ? Number(dm[1]) : null, days: dm ? Number(dm[2]) : days.length, image: card?.image || null, overview, itinerary: days, itineraryNote, inclusions, exclusions, exclusionsMissing, places: [...new Set(overview.map((o) => o.place).filter(Boolean).map((p) => p.replace(/\s*–.*$/, "").replace("Chinag", "Chiang")))] };
}
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function titleCase(s) {
  return s.toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase()).replace(/\bAnd\b/g, "&").replace(/\bOf\b/g, "of").replace(/\bThe\b(?!$)/g, "the").replace(/^the/, "The").replace(/\bTo\b/g, "to").replace(/\bAt\b/g, "at").replace(/\bIn\b/g, "in").replace(/\b(\d+)(st|nd|rd|th)\b/gi, (m, n, suf) => n + suf.toLowerCase()).replace(/U\.a\.e/g, "U.A.E").replace(/Uae/g, "UAE");
}
function durationTableOf(sectionNum) {
  const pre = parseBlocks(bySection[sectionNum].preamble);
  const t = pre.find((x) => x.type === "table");
  const map = new Map();
  if (t) for (const r of t.rows) map.set(slugFromUrl(r[2]), r[1]);
  return map;
}

// --- Bike trips: gallery, equipment, road trips -------------------------------
function extractBikeTrips() {
  const sec = bySection[11];
  const gallery = pageRecord(sec.pages.find((p) => p.title === "Gallery"));
  const equipment = pageRecord(sec.pages.find((p) => /Equipment/.test(p.title)));
  const dest = pageRecord(sec.pages.find((p) => p.title === "Destinations"));
  const eqGroups = [];
  let g = null;
  for (let i = 0; i < equipment.blocks.length; i++) {
    const x = equipment.blocks[i];
    if (x.type === "heading" && /^(MOTORCYCLES|Equipment & Safety Gear)$/i.test(x.text)) { g = { title: titleCase(x.text), items: [] }; eqGroups.push(g); continue; }
    if (x.type === "image" && g) { const cap = equipment.blocks[i + 1]?.type === "heading" ? equipment.blocks[i + 1].text : ""; const caption = cleanCaption(cap); g.items.push({ image: x.src, caption: caption || "Riding accessory" }); }
  }
  const trips = [];
  for (let i = 0; i < dest.blocks.length; i++) {
    const x = dest.blocks[i];
    const m0 = x.type === "heading" && /^(\d+)\.\s*(.+)$/.exec(x.text);
    if (!m0) continue;
    const dist = /\((\d+\s*km)(?: away)?\)/i.exec(m0[2]);
    const m = [m0[0], m0[1], m0[2].replace(/\s*\(\d+\s*km(?: away)?\)/gi, "").trim(), dist ? dist[1] : null];
    const paras = [];
    let image = null;
    for (let j = i + 1; j < dest.blocks.length && dest.blocks[j].type !== "heading"; j++) {
      if (dest.blocks[j].type === "image") image = dest.blocks[j].src;
      if (dest.blocks[j].type === "paragraph") paras.push(dest.blocks[j].text);
    }
    const title = m[2].trim();
    const km = m[3] ? Number(/(\d+)/.exec(m[3])?.[1]) : null;
    trips.push({ id: title.replace(/^Delhi to /i, "").replace(/\s*\+.*$/, "").replace(/\s*&.*$/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""), title, distanceLabel: m[3] || null, distanceKm: km, image, paras });
  }
  return {
    gallery: { ...pageMeta(gallery), images: gallery.blocks.filter((x) => x.type === "image").map((x) => x.src) },
    equipment: { ...pageMeta(equipment), groups: eqGroups },
    roadTrips: { ...pageMeta(dest), intro: firstOf(dest.blocks, "paragraph")?.text, trips },
  };
}
const cleanCaption = (s) => s.replace(/_/g, " ").replace(/\b(\w+?)(\d+)$/i, (m, w, d) => (/^(GOGGLES|RED|BLACK|GREEN|VIEW|RACK|BEIGE)$/i.test(w) ? w : m)).replace(/\s+\d+$/, "").trim();

// --- Blog -------------------------------------------------------------------
function extractBlog() {
  const sec = bySection[12];
  const listing = pageRecord(sec.pages[0]);
  const thumbs = new Map();
  for (const x of listing.blocks) if (x.type === "image" && x.href) thumbs.set(pathFromUrl(x.href), x.src);
  const posts = sec.pages.slice(1).map((p) => {
    const rec = pageRecord(p);
    const body = rec.rawBody.replace(/^#### /gm, "## ").replace(/^##### /gm, "### ").replace(/^###### /gm, "#### ");
    const html = marked.parse(rewriteMediaInText(body));
    const firstPara = rec.blocks.find((x) => x.type === "paragraph")?.text || "";
    const words = rec.rawBody.split(/\s+/).length;
    return { ...pageMeta(rec), published: rec.published, excerpt: firstPara.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").slice(0, 220).trim(), image: thumbs.get(rec.path) || rec.blocks.find((x) => x.type === "image")?.src || null, readingMinutes: Math.max(2, Math.round(words / 220)), html };
  });
  return { listing: pageMeta(listing), posts };
}

// ---------------------------------------------------------------------------
// 4. Run
// ---------------------------------------------------------------------------
const write = (name, data) => fs.writeFileSync(path.join(OUT, name), JSON.stringify(data, null, 2) + "\n");

const home = extractHome();
const about = extractAbout();
const contact = extractContact();
const other = extractOther();

const carTours = bySection[5].pages.map((p) => extractDayTour(pageRecord(p), "car"));
const busTours = bySection[6].pages.map((p) => extractDayTour(pageRecord(p), "bus"));
const multiDay = bySection[7].pages.map((p) => extractMultiDay(pageRecord(p)));
const cabs = bySection[8].pages.map((p) => extractCabPage(pageRecord(p)));

const dubaiLanding = extractIntlLanding(pageRecord(bySection[9].pages[0]));
const thaiLanding = extractIntlLanding(pageRecord(bySection[10].pages[0]));
const dubaiPackages = bySection[9].pages.slice(1).map((p) => extractIntlPackage(pageRecord(p), "dubai", dubaiLanding, durationTableOf(9)));
const thaiPackages = bySection[10].pages.slice(1).map((p) => extractIntlPackage(pageRecord(p), "thailand", thaiLanding, durationTableOf(10)));
const bike = extractBikeTrips();
const blog = extractBlog();

for (const s of sections) for (const p of s.pages) allPages.push({ section: s.title, ...pageMeta(pageRecord(p)) });

write("home.json", home);
write("about.json", about);
write("contact.json", contact);
write("privacy.json", other.privacy);
write("thank-you.json", other.thankYou);
write("tours.json", { car: carTours, bus: busTours, multiDay });
write("cabs.json", cabs);
write("international.json", { landings: { dubai: dubaiLanding, thailand: thaiLanding }, packages: [...dubaiPackages, ...thaiPackages] });
write("gallery.json", bike.gallery);
write("equipment.json", bike.equipment);
write("roadtrips.json", bike.roadTrips);
write("blog.json", blog);
write("pages.json", allPages);

// Media manifest: every local media path referenced anywhere in the generated data.
const media = new Set();
const walk = (v) => { if (typeof v === "string") { for (const m of v.matchAll(/\/media\/wp\/[^\s"')]+/g)) media.add(m[0]); } else if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === "object") Object.values(v).forEach(walk); };
walk({ home, about, contact, other, carTours, busTours, multiDay, cabs, dubaiLanding, thaiLanding, dubaiPackages, thaiPackages, bike, blog });
write("media-manifest.json", [...media].sort().map((p) => ({ local: p, remote: WP_PREFIX + p.slice("/media/wp/".length) })));

console.log(`pages: ${allPages.length}, car tours: ${carTours.length}, bus: ${busTours.length}, multi-day: ${multiDay.length}, cab pages: ${cabs.length} (${cabs.reduce((a, c) => a + c.routes.length, 0)} routes), intl packages: ${dubaiPackages.length + thaiPackages.length}, road trips: ${bike.roadTrips.trips.length}, posts: ${blog.posts.length}, media files: ${media.size}`);
