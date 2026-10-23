/**
 * Downloads imagery into public/media/:
 *  1. The company's own images referenced by the content archive (src/data/generated/media-manifest.json)
 *     -> public/media/wp/<same path>, re-encoded to max 1600px wide (GIFs kept as-is).
 *  2. CC-licensed Wikimedia Commons photographs for destinations where the company site has no
 *     hero-quality photo -> public/media/commons/<id>-{480,960,1600}.webp, with author/licence
 *     recorded in src/data/generated/photos.json (rendered as attribution captions).
 *
 * Idempotent: existing files are skipped. Run: npm run assets:fetch
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PUB = path.join(ROOT, "public");
const UA = "NUABTourismSiteBuilder/0.1 (contact.us@nuabtourism.com)";

async function get(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": UA } });
      if (r.ok) return Buffer.from(await r.arrayBuffer());
      if (r.status === 404) return null;
    } catch {}
    await new Promise((res) => setTimeout(res, 800 * (i + 1)));
  }
  return null;
}

// ---------------------------------------------------------------------------
// 1. Company images
// ---------------------------------------------------------------------------
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "src/data/generated/media-manifest.json"), "utf8"));
let ok = 0, skipped = 0, missing = [];
await Promise.all(
  Array.from({ length: 6 }, async (_, worker) => {
    for (let i = worker; i < manifest.length; i += 6) {
      const { local, remote } = manifest[i];
      const dest = path.join(PUB, decodeURIComponent(local));
      if (fs.existsSync(dest)) { skipped++; continue; }
      const buf = await get(remote);
      if (!buf) { missing.push(remote); continue; }
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      const ext = path.extname(dest).toLowerCase();
      try {
        if (ext === ".gif") fs.writeFileSync(dest, buf);
        else {
          let img = sharp(buf, { failOn: "none" }).rotate().resize({ width: 1600, withoutEnlargement: true });
          img = ext === ".png" ? img.png({ compressionLevel: 9, palette: false }) : ext === ".webp" ? img.webp({ quality: 80 }) : img.jpeg({ quality: 80, mozjpeg: true });
          fs.writeFileSync(dest, await img.toBuffer());
        }
        ok++;
      } catch (e) {
        fs.writeFileSync(dest, buf);
        ok++;
      }
    }
  }),
);
console.log(`company images: ${ok} downloaded, ${skipped} already present, ${missing.length} missing`);
if (missing.length) console.log(missing.join("\n"));

// ---------------------------------------------------------------------------
// 2. Wikimedia Commons photographs
// ---------------------------------------------------------------------------
// id -> search query. Featured journey stops first; the rest enrich the directory/atlas cards.
const TOPICS = {
  "delhi-india-gate": "India Gate New Delhi",
  "delhi-qutub-minar": "Qutub Minar",
  "delhi-humayun-tomb": "Humayun's Tomb",
  "agra-taj-mahal": "Taj Mahal",
  "agra-fort": "Agra Fort",
  "jaipur-hawa-mahal": "Hawa Mahal",
  "jaipur-amer-fort": "Amer Fort",
  "jaipur-jal-mahal": "Jal Mahal Jaipur",
  "vrindavan-prem-mandir": "Prem Mandir Vrindavan",
  "mathura-ghat": "Vishram Ghat Mathura",
  "rishikesh-laxman-jhula": "Lakshman Jhula Rishikesh",
  // exact file chosen by hand: free-text search returned the Golden Temple, Amritsar
  "haridwar-har-ki-pauri": "File:Sunrise view of the main bathing ghat at Har-ki-pauri, Haridwar.jpg",
  "uttarakhand-himalaya": "Garhwal Himalaya",
  "shimla": "Shimla town",
  "manali": "Manali Himachal",
  "dharamshala": "McLeod Ganj",
  "nainital": "Naini Lake",
  "mussoorie": "Mussoorie",
  "katra-vaishno-devi": "Trikuta mountains Katra",
  "dubai-skyline": "Dubai skyline Burj Khalifa",
  "abu-dhabi-grand-mosque": "Sheikh Zayed Grand Mosque",
  "bangkok-wat-arun": "Wat Arun",
  "krabi-railay": "Railay Krabi",
  "phuket": "Phuket",
  "chiang-mai-doi-suthep": "Wat Phra That Doi Suthep",
  "koh-samui": "Ko Samui",
};

const strip = (s) => (s || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
async function byTitle(title) {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&titles=${encodeURIComponent(title)}&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiextmetadatafilter=LicenseShortName|Artist|LicenseUrl|ImageDescription&iiurlwidth=1600`;
  const buf = await get(url);
  if (!buf) return [];
  const j = JSON.parse(buf.toString());
  return Object.values(j.query?.pages || {}).filter((p) => p.imageinfo).map((p) => ({ title: p.title, ...p.imageinfo[0] }));
}
async function search(q, quality) {
  if (q.startsWith("File:")) return byTitle(q);
  const query = quality ? `${q} incategory:Quality_images` : q;
  const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=12&gsrsearch=${encodeURIComponent(query + " filetype:bitmap")}&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiextmetadatafilter=LicenseShortName|Artist|LicenseUrl|ImageDescription&iiurlwidth=1600`;
  const buf = await get(url);
  if (!buf) return [];
  const j = JSON.parse(buf.toString());
  return Object.values(j.query?.pages || {})
    .sort((a, b) => a.index - b.index)
    .map((p) => ({ title: p.title, ...p.imageinfo[0] }))
    .filter((x) => /jpeg|png/.test(x.mime) && /^(CC|Public domain|PD)/i.test(x.extmetadata?.LicenseShortName?.value || ""));
}

const PHOTOS_JSON = path.join(ROOT, "src/data/generated/photos.json");
const photos = fs.existsSync(PHOTOS_JSON) ? JSON.parse(fs.readFileSync(PHOTOS_JSON, "utf8")) : {};
const outDir = path.join(PUB, "media", "commons");
fs.mkdirSync(outDir, { recursive: true });

for (const [id, q] of Object.entries(TOPICS)) {
  if (photos[id] && fs.existsSync(path.join(outDir, `${id}-1600.webp`))) continue;
  await new Promise((r) => setTimeout(r, 2500)); // be polite to the Commons API (avoids rate limiting)
  let cands = await search(q, true);
  if (!cands.length) cands = await search(q, false);
  // Prefer landscape frames for editorial layouts
  const pick = cands.find((c) => c.width >= 1600 && c.width > c.height * 1.2) || cands.find((c) => c.width >= 1200) || cands[0];
  if (!pick) { console.log(`commons: no result for ${id}`); continue; }
  const buf = await get(pick.thumburl || pick.url);
  if (!buf) { console.log(`commons: download failed for ${id}`); continue; }
  const meta = await sharp(buf).metadata();
  for (const w of [480, 960, 1600]) {
    await sharp(buf).rotate().resize({ width: w, withoutEnlargement: true }).webp({ quality: w > 1000 ? 74 : 78 }).toFile(path.join(outDir, `${id}-${w}.webp`));
  }
  const em = pick.extmetadata || {};
  photos[id] = {
    id,
    src: `/media/commons/${id}-1600.webp`,
    srcSet: [480, 960, 1600].map((w) => `/media/commons/${id}-${w}.webp ${w}w`).join(", "),
    width: Math.min(1600, meta.width || 1600),
    height: Math.round(Math.min(1600, meta.width || 1600) * ((meta.height || 1) / (meta.width || 1))),
    title: pick.title.replace(/^File:/, "").replace(/\.[a-z]+$/i, ""),
    author: strip(em.Artist?.value) || "Unknown author",
    license: em.LicenseShortName?.value || "",
    licenseUrl: em.LicenseUrl?.value || null,
    sourceUrl: pick.descriptionurl,
    alt: strip(em.ImageDescription?.value).slice(0, 160) || q,
  };
  console.log(`commons: ${id} <- ${pick.title} (${photos[id].license}, ${photos[id].author})`);
  fs.writeFileSync(PHOTOS_JSON, JSON.stringify(photos, null, 2) + "\n");
}
fs.writeFileSync(PHOTOS_JSON, JSON.stringify(photos, null, 2) + "\n");
console.log(`commons photos: ${Object.keys(photos).length}`);
