# NUAB Tourism — The Immersive Journey

A scroll-driven 3D travel website for NUAB Tourism, built on Next.js 15. The client's own airliner model flies a five-stop journey over an engraved atlas of northern India. A live MapLibre atlas and the full tour catalogue follow.

Design system: **Atlantic Editorial**. The palette is Deep Navy `#233A50`, Midnight `#172B3D`, Powder Blue `#DEE8F4`, Sky Blue `#A8C9E8`, Warm Ivory `#F6F2EA`, Sandstone `#C6A77B`, Stone Grey `#838177`, White, Blue Mist `#F4F7FA`, Ink `#20252B`, Muted `#566371` and Border `#D9E0E7`. Type is Fraunces for display, Manrope for the interface and DM Mono for cartographic detail. The tokens live in `src/app/globals.css`.

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000 (also copies the MapLibre worker into public/vendor)
npm run build && npm start
```

Checks:

```bash
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm test             # data-fidelity tests (vitest): prices, durations, links vs. the content archive
```

## Where the content comes from

`nuabtourism-site-content.md` is the authoritative business data: an archive of all 68 pages of nuabtourism.in. The brief referred to a `WEBSITE_DATA.md`, but no such file exists, so this archive is used instead.

| Script | What it does |
|---|---|
| `npm run data:extract` | Parses the archive into `src/data/generated/*.json`: tours, fares, itineraries, cabs, packages, blog, gallery and road trips. Never hand-edit these files. |
| `npm run assets:fetch` | Downloads the company's own images into `public/media/wp/`. It also pulls CC-licensed Wikimedia Commons photographs into `public/media/commons/`, recording author and licence in `photos.json`. Credits are shown on every photo. |
| `npm run model:convert` | Converts the client's `assets/source/3d-model.3ds` into `public/models/nuab-aircraft.glb`. |
| `npm run model:landmark -- <obj> <out.glb> [options]` | Converts a landmark OBJ into a compact, meshopt-compressed GLB for the journey. Options: `--texture`, `--simplify`, `--crease`, `--ao` and more (listed at the top of `scripts/convert-landmark.mjs`). |

The destination list is in `src/data/destinations.ts`. It holds stable ids and true coordinates, and it is the single source for the journey, the map, search and the directory. Descriptions and related offers on it are derived from the extracted data.

## The aircraft

- **Source:** the client's model, `3d-model.3ds.zip`. The extracted original lives in `assets/source/` and is never modified.
- **Why a custom converter:** in this SketchUp export, the right-hand gear, engine, fan blades and nacelle exist only as keyframer instances, and mirrored parts store un-mirrored vertices. The three.js `TDSLoader` ignores both, which renders a half-assembled aircraft. `scripts/convert-3ds.mjs` applies the keyframer transforms and the 3ds Max mirror rule. It then checks that every left/right pair is symmetric; the worst offset is 0.02 units on a 10-unit airframe.
- **Output:** a 287 KB meshopt-compressed GLB, about 35k triangles. Its named nodes (`fuselage`, `gear`, `fan_left`, `fan_right`, `tail_fin`) are used for gear retraction, fan spin and livery.
- **Materials:** the 3DS flat colours are mapped to PBR in `assets/aircraft-materials.json`. The tail fin is re-coloured navy as livery. Four engine-fan textures referenced by the model were not shipped with it, so those parts render as plain metal.
- **Branding:** "NUAB TOURISM" titles and a navy cheatline are projected decals that conform to the fuselage, in `src/components/journey/Aircraft.tsx`. The model has no usable UV layout for a painted texture, so decals were the faithful option. The geometry is untouched.
- **Static fallback:** `public/media/aircraft-hero.png` is a render of the real model with its livery. Regenerate it with `node scripts/capture-aircraft.mjs` while `npm run dev` is running; it uses the dev-only route `/dev-preview/aircraft/`.

## Landmark models

Real 3D monuments can replace the line engravings, one stop at a time. India Gate stands at Delhi, the Taj Mahal at Agra, the Hawa Mahal at Jaipur, the Ram Mandir at Mathura–Vrindavan and Laxman Jhula at Haridwar–Rishikesh.

- **Source:** `india-gate-lowpoly-3d-model.zip`, supplied by the client. The zip stays in `assets/source/` locally and is not committed; its extracted files are. It is a low-poly OBJ (653 triangles) with one 2048 px photographic texture. The extracted files are in `assets/source/india-gate/`. Confirm that the model's licence allows use on a commercial website before launch; the archive carries no licence or author information.
- **Taj Mahal source:** `taj-mahal.zip`, supplied by the client, kept locally in `assets/source/`; the extracted OBJ is in `assets/source/taj-mahal/`. It has 139k triangles and no texture or UVs. The converter simplifies it to 48.5k triangles, rebuilds smooth-with-crease normals and bakes ambient occlusion into vertex colours, which is what gives the untextured marble its depth. It uses a warm marble (`--color "#d9c6a6"`) and full-strength, slightly wider occlusion (`--ao-strength 1 --ao-radius 0.2`) so it doesn't wash out to white against the pale atlas. The result is a 1 MB GLB. As with India Gate, the archive carries no licence or author, so confirm the licence before launch.
- **Taj Mahal placement:** it uses an `offset` to stand further ahead and further out than the default engraving spot, and the Agra camera is raised so the aircraft passes in front of the plinth. On the hero skyline it stands far behind the aircraft, larger and without haze, so its dome and minarets rise above the fuselage like a travel poster, with India Gate in front of it.
- **Hawa Mahal:** no free model of usable quality was available, so it is generated in code by `scripts/build-hawa-mahal.mjs`. The model is stylised, not a survey: the street facade is built as a stepped pyramid of storeys, with rows of semi-hexagonal jharokhas (white-framed jali panels and domed caps), white lime cornices, an arcaded ground floor with the central gateway, and chhatris on the step corners. The colours are per-vertex (pink sandstone, white trim, dark lattice). The converter keeps them and multiplies them with baked occlusion, giving a 194 KB GLB of 11k triangles. Like the Taj, it stands further out than the engraving spot, with the Jaipur camera raised so the aircraft passes below it. The flight passes Jaipur on a straight westbound leg and loops back east toward Mathura only after the stop, so the camera holds steady and the Hawa Mahal is on screen for as long as the Jaipur card is. It keeps the line engraving on the hero skyline (`hero: false`).
  ```bash
  node scripts/build-hawa-mahal.mjs .dev/hawa-mahal/hawa-mahal.obj
  npm run model:landmark -- .dev/hawa-mahal/hawa-mahal.obj public/models/landmarks/hawa-mahal.glb --crease 32 --ao-strength 0.6
  ```
- **Laxman Jhula:** generated in code by `scripts/build-laxman-jhula.mjs`, because no free model was available. It follows the line engraving: the suspension bridge crosses the Ganga between stepped stone ghats, with cream tower gates carrying pointed-arch panels and saffron domes. It has the sagging main cables, back-stays, hangers and railings, and the tiered Tera Manzil temple stands on the far bank. The result is a 72 KB GLB of 4k triangles. It shares its mesh helpers with the Hawa Mahal generator (`scripts/lib/procedural-mesh.mjs`).
  ```bash
  node scripts/build-laxman-jhula.mjs .dev/laxman-jhula/laxman-jhula.obj
  npm run model:landmark -- .dev/laxman-jhula/laxman-jhula.obj public/models/landmarks/laxman-jhula.glb --crease 32 --ao-strength 0.6
  ```
- **Temple source:** `ram-temple.zip`, supplied by the client, kept locally in `assets/source/` and extracted to `assets/source/ram-temple/`. It is a model of the Ayodhya Ram Mandir: a 22 MB GLB with 170k triangles and mirror-metal rose-gold materials. `scripts/glb-to-obj.mjs` flattens each material to its average texture colour and writes an OBJ with vertex colours. The landmark converter then simplifies it, rebuilds normals and bakes occlusion, giving a 772 KB GLB of 51k triangles in matte pink sandstone with the white plinth and saffron flag. It appears on the hero skyline, left of the aircraft's nose, and at the Mathura–Vrindavan stop, set back from the flight line (`offset: { ahead: 18, across: 44 }`) so the aircraft does not cover it. Visibility zones keep Delhi's India Gate out of that view. As with the other supplied models, the archive carries no licence or author, so confirm the licence before launch.
  ```bash
  node scripts/glb-to-obj.mjs assets/source/ram-temple/source/Untitled.glb .dev/ram-temple/ram-temple.obj
  npm run model:landmark -- .dev/ram-temple/ram-temple.obj public/models/landmarks/ram-temple.glb --simplify 0.3 --crease 40
  ```
- **Conversion:** `scripts/convert-landmark.mjs` centres the model on its base, scales it to a height of 1, converts the texture to WebP (keeping the alpha cut-outs for the Amar Jawan Jyoti rifles and finials) and writes a 274 KB GLB to `public/models/landmarks/india-gate.glb`.
- **Hero:** any skyline monument with a model uses it instead of its engraving (`HeroLandmarkModels`, placed through `HERO_MODEL_PLACEMENT` in `Landmarks.tsx`).
- **In the scene:** `LandmarkModels` in `src/components/journey/Landmarks.tsx` stands the model across from the aircraft, turned so its main arch faces the stop camera. Monuments are permanent: they never rise, sink or fade. Each one belongs to one part of the journey, the hero skyline or its own stop, and is shown exactly while the camera naturally sees it there. That stretch is sampled from the camera path itself (`poseCameraAt`, sharing the flight rig's composition), so a monument enters and leaves at the edge of the screen and never appears in another stop's view. Clouds are kept off the monument and its sightline, and the stop's photo postcard is hidden because the model replaces it.

To add another monument:

1. Put the zip in `assets/source/` and extract it into its own folder. If the model is a GLB, turn it into an OBJ first with `node scripts/glb-to-obj.mjs <in.glb> <out.obj>`.
2. Run the converter. A textured model:
   ```bash
   npm run model:landmark -- assets/source/prem-mandir/model.obj public/models/landmarks/prem-mandir.glb --texture assets/source/prem-mandir/texture.png
   ```
   An untextured, high-poly model (simplify, rebuild normals, bake shading):
   ```bash
   npm run model:landmark -- "assets/source/taj-mahal/Taj Mahal Low.obj" public/models/landmarks/taj-mahal.glb --simplify 0.35 --crease 40 --color "#d9c6a6" --ao-strength 1 --ao-radius 0.2
   ```
3. Add a `model` entry to that stop in `src/components/journey/config.ts`. `height` is in scene units, so 15 matches India Gate. `facade` is the model axis its main face looks along, and `yaw` fine-tunes the angle in degrees.
   ```ts
   model: { url: "/models/landmarks/prem-mandir.glb", height: 15, facade: "+x", yaw: -24 },
   ```
   Optional: `offset: { ahead, across }` moves it from the default spot, and `hero: false` keeps the line engraving on the hero skyline.

## How the scroll journey works

- **Hero scene:** the first viewport is a dawn flight above a cloud sea. A three-stop sky shader (zenith, sky blue, warm horizon) carries a sunrise glow placed behind the aircraft. A sunlit cloud deck dissolves as the journey begins. Real models of India Gate, the Taj Mahal, the Ram Mandir and the Hawa Mahal stand on the horizon around the aircraft; they leave the frame naturally as the camera turns toward Delhi. A CSS twin of the sky (`.sky-hero`) paints instantly, before WebGL. The copy rises in about one second, and the aircraft glides into its composition in about 1.8 seconds. There is no blocking intro screen.
- **Himalaya:** north of Haridwar–Rishikesh, the journey climbs over a low-poly 3D range (`Ridges` in `Environment.tsx`). It is a ridged-noise heightfield, flat-shaded and coloured by height and slope: sage foothills, slate rock faces, and snow above a noisy snowline. Under the flight route the terrain is held at least 7 units below the aircraft and the chase camera, blending back to full height 75 units out.
- **Lighting:** a camera-relative warm key light, a sky and ground hemisphere fill, a sun rim light, and a soft reflection environment. Paint and metal finishes are tuned at runtime; the GLB itself is unchanged.

- **Pace:** the journey section is 1020vh tall on desktop and 840vh on mobile, and the aircraft eases toward the scroll position with gentle damping, so it glides rather than jumps. Change the section height in `Journey.tsx` to make the whole flight faster or slower.
- **One progress source:** a single GSAP ScrollTrigger supplies progress 0–1. It writes a mutable store that the WebGL frame loop reads, so scrolling causes no React re-renders, and it scrubs the DOM panel timeline. Native scrolling is never hijacked.
- **Flight path:** a centripetal Catmull-Rom curve. The aircraft's orientation follows the curve tangent, it banks from the turn rate, and it retracts its gear after takeoff.
- **Camera:** per-stop camera keyframes put the camera opposite each landmark, so the aircraft crosses in front of the engraving. The nose always points toward the text column.
- **Landmarks and route:** fine-line engravings of India Gate, the Taj Mahal, Hawa Mahal, a Vrindavan temple and Laxman Jhula are generated in code (`src/components/engraving/drawings.ts`). The same data renders as SVG on pages and as 3D line geometry in the scene. A route contrail draws in behind the aircraft, and markers sit at the true coordinates.
- **Fallback modes:** the server renders a complete static journey. That version is also what visitors see with reduced motion, without WebGL, or with `?no3d=1`.
- **QA hooks:** in development and QA, `window.__nuabJourney` and `window.__nuabJourneyGoTo(p)` expose the journey state.

The flight is a storytelling device. The site never presents it, or any straight line, as a real flight or road route.

## The atlas map

The map uses MapLibre GL with the free, key-less OpenFreeMap "positron" style, restyled to the palette. Attribution is shown on the map.

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_MAP_STYLE_URL` | Optional override for the map style URL. |
| `NEXT_PUBLIC_SITE_URL` | Canonical origin for metadata, the sitemap and robots. Defaults to `https://nuabtourism.in`. |

If the map fails to load, the directory and destination panels remain fully usable.

**Flights:** small airliners take off from the Delhi hub in every direction. Each follows a gentle arc to one of the destinations currently shown, trailing a fading contrail and growing as it "climbs". Departures are staggered so there are always planes in the air, and a ring pulses at Delhi. Domestic flights (navy) follow the region and filter selection. International flights (coral) to every UAE and Thailand destination always run, so even the North India view shows them climbing out of Delhi. Each international destination keeps a small coral ring, so its arc lands even when the filters hide that marker. They pause when the map is off-screen or the tab is hidden. With reduced motion, only the faint arcs are drawn. The flights live in `src/components/map/flights.ts` and are labelled in the legend as illustrative, so they imply no routes, airlines or schedules.

## Known limitations

- **Enquiry form:** it is a visual prototype, as the client requested. It validates and shows a confirmation but sends nothing. Add the backend call where `fakeSubmit` sits in `src/components/ui/Enquiry.tsx`.
- **Bookings:** "Book" buttons link to the existing booking engine at `booking.nuabtourism.in`, or to WhatsApp, as on the live site.
- **International packages:** Dubai and Thailand packages show "price on enquiry" because the archive publishes no prices for them.

## Source-data discrepancies found and handled

| Discrepancy in the archive | How the site handles it |
|---|---|
| Every outstation-cab WhatsApp link pre-fills "Delhi to Bir Billing". | Links are regenerated with the correct destination. The original link is kept in the data. |
| The 6-day Golden Triangle package's "Book Now" points to a bus-tour booking URL on a Vercel domain. | Not used. That package shows enquiry options instead. |
| The Mathura same-day pages (car and bus) and the Jaipur bus page carry the Agra "Places Covered" list. | They show their own attraction list instead (`placesCorrected` flag). |
| The Thailand landing page contains a copied paragraph about Dubai. | That paragraph is omitted. |
| The Breathtaking Ras Al Khaimah page's exclusion tab repeats its overview. | It shows "exclusions confirmed with your quotation". |
| "Delhi to Chhota" is routed via Rishikesh, Rudraprayag and Ukhimath. | Mapped as Chopta and labelled "Chhota (Chopta)". This is an assumption to confirm with the client. |
| The site's trust figures (8m+ travellers, 5,000+ reviews, IATA) are NUAB's own claims. | Shown and labelled "as published by NUAB Tourism". |
