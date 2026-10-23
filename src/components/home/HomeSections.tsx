import Link from "next/link";
import { ArrowRight, ArrowUpRight, BadgeCheck, Headphones, Mail, MapPin, Phone, Star, Users } from "lucide-react";
import { about, busTours, carTours, equipment, gallery, home, intlLandings, intlPackages, multiDayTours, photo, roadTrips } from "@/data";
import { SITE, formatINR, whatsappLink } from "@/lib/site";
import { Engraving } from "@/components/engraving/Engraving";
import { EnquireButton } from "@/components/ui/Enquiry";
import { WorldRoutes } from "./WorldRoutes";

// ---------------------------------------------------------------------------
// Featured tours — an editorial index, not a card grid
// ---------------------------------------------------------------------------
export function FeaturedTours() {
  return (
    <section id="tours" className="relative scroll-mt-20 overflow-hidden bg-ivory py-24 md:py-32" aria-labelledby="featured-tours">
      <Engraving id="taj-mahal" className="pointer-events-none absolute -right-16 top-10 hidden w-[34rem] text-sand/45 xl:block" weight={1.3} />
      <div className="container-x relative">
        <div className="grid gap-8 lg:grid-cols-[1fr_1.4fr] lg:items-end">
          <div>
            <p className="eyebrow !text-sand-deep">Tour packages from Delhi</p>
            <h2 id="featured-tours" className="mt-3 text-display-md text-balance">One price. Whole vehicle.</h2>
          </div>
          <p className="max-w-2xl text-lede text-ink/75">{home.whyBook.find((w) => /One price/i.test(w.title))?.text}</p>
        </div>

        <div className="mt-14 grid gap-14 lg:grid-cols-2">
          <div>
            <h3 className="flex items-baseline justify-between border-b border-navy pb-3 font-sans text-sm font-semibold uppercase tracking-[0.14em] text-navy">
              Same-day by private car <span className="font-mono text-[0.68rem] font-normal tracking-[0.1em] text-muted">fare per vehicle</span>
            </h3>
            <ol className="divide-y divide-line">
              {carTours.map((t, i) => (
                <li key={t.slug}>
                  <Link href={t.path} className="group grid grid-cols-[2rem_1fr_auto] items-baseline gap-3 py-4">
                    <span className="font-mono text-[0.7rem] text-stone">{String(i + 1).padStart(2, "0")}</span>
                    <span>
                      <span className="block font-display text-[1.3rem] leading-snug text-navy group-hover:underline group-hover:decoration-1 group-hover:underline-offset-4">{t.title.replace(/ by Car$/, "")}</span>
                      <span className="mt-0.5 block font-mono text-[0.66rem] uppercase tracking-[0.08em] text-muted">{t.places.slice(0, 3).join(" · ")}</span>
                    </span>
                    <span className="text-right">
                      <span className="block text-[0.95rem] font-semibold">from {formatINR(t.fromPrice)}</span>
                      <span className="block text-[0.7rem] text-muted">{t.durationText === "Full day" ? "Full day" : t.durationText}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
            <h3 id="bus" className="mt-12 flex items-baseline justify-between border-b border-navy pb-3 font-sans text-sm font-semibold uppercase tracking-[0.14em] text-navy">
              Same-day by coach <span className="font-mono text-[0.68rem] font-normal tracking-[0.1em] text-muted">fare per seat</span>
            </h3>
            <ul className="grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-4">
              {busTours.map((t) => (
                <li key={t.slug} className="bg-white">
                  <Link href={t.path} className="block h-full p-4 hover:bg-mist">
                    <span className="block text-[0.9rem] font-semibold text-navy">{t.title.replace(/ (Same Day|One Day) Tour by Bus$/, "")}</span>
                    <span className="mt-1 block text-[0.85rem]">from {formatINR(t.fromPrice)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div id="multi-day">
            <h3 className="flex items-baseline justify-between border-b border-navy pb-3 font-sans text-sm font-semibold uppercase tracking-[0.14em] text-navy">
              Golden Triangle & pilgrimage <span className="font-mono text-[0.68rem] font-normal tracking-[0.1em] text-muted">multi-day</span>
            </h3>
            <ol className="divide-y divide-line">
              {multiDayTours.map((t) => (
                <li key={t.slug}>
                  <Link href={t.path} className="group flex items-baseline justify-between gap-4 py-4">
                    <span>
                      <span className="block font-display text-[1.2rem] leading-snug text-navy group-hover:underline group-hover:decoration-1 group-hover:underline-offset-4">{t.title}</span>
                      <span className="mt-0.5 block font-mono text-[0.66rem] uppercase tracking-[0.08em] text-muted">{t.durationText}</span>
                    </span>
                    <span className="shrink-0 text-right">
                      {t.fromPrice ? (
                        <>
                          <span className="block text-[0.95rem] font-semibold">from {formatINR(t.fromPrice)}</span>
                          <span className="block text-[0.7rem] text-muted">{t.pricing?.basis}</span>
                        </>
                      ) : (
                        <span className="text-[0.8rem] text-muted">Price on enquiry</span>
                      )}
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link href="/tours/" className="btn btn-primary">All tours & fares <ArrowRight className="size-4" aria-hidden /></Link>
              <Link href="/delhi-to-uttarakhand-cabs/" className="btn btn-ghost">Outstation cabs from ₹10/km</Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// International discovery
// ---------------------------------------------------------------------------
export function International() {
  const groups = (["dubai", "thailand"] as const).map((c) => ({
    c,
    landing: intlLandings[c],
    pkgs: intlPackages.filter((p) => p.country === c),
    hero: c === "dubai" ? photo("dubai-skyline")?.src ?? intlLandings.dubai.heroImage : intlLandings.thailand.heroImage,
  }));
  return (
    <section className="relative overflow-hidden bg-midnight py-24 text-white md:py-32" aria-labelledby="intl-title">
      <div className="container-x">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:items-center">
          <div>
            <p className="eyebrow !text-sand">Beyond India</p>
            <h2 id="intl-title" className="mt-3 text-display-md text-balance !text-white">Dubai & Thailand, planned from Gurugram.</h2>
            <p className="mt-5 max-w-xl text-lede text-white/75">{intlLandings.dubai.aboutParas[2]}</p>
            <p className="mt-6 font-mono text-[0.66rem] uppercase tracking-[0.12em] text-white/50">Flights are not sold or tracked on this site · durations as published</p>
          </div>
          <div className="bg-white p-3 text-ink shadow-[0_40px_80px_-40px_rgb(0_0_0/.6)]"><WorldRoutes /></div>
        </div>

        <div className="mt-16 grid gap-px bg-white/10 text-ink md:grid-cols-2">
          {groups.map((g) => (
            <article key={g.c} className="flex flex-col bg-white">
              {g.hero && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={g.hero} alt={g.c === "dubai" ? "Dubai skyline with the Burj Khalifa" : "Thai temple at sunset"} loading="lazy" className="aspect-[16/7] w-full object-cover" />
              )}
              <div className="flex flex-1 flex-col p-6 md:p-8">
                <p className="coord">{g.c === "dubai" ? "25°12′ N · 55°16′ E — UNITED ARAB EMIRATES" : "13°45′ N · 100°30′ E — THAILAND"}</p>
                <h3 className="mt-2 text-display-sm">{g.c === "dubai" ? "Dubai & the Emirates" : "Thailand"}</h3>
                <p className="mt-1 text-sm text-muted">{g.pkgs.length} itineraries · prices on enquiry</p>
                <ul className="mt-5 divide-y divide-line border-y border-line">
                  {g.pkgs.slice(0, 6).map((p) => (
                    <li key={p.slug}>
                      <Link href={p.path} className="flex items-baseline justify-between gap-3 py-2.5 text-[0.92rem] hover:text-navy">
                        <span className="font-semibold text-navy">{p.title}</span>
                        <span className="shrink-0 font-mono text-[0.62rem] uppercase tracking-[0.08em] text-muted">{p.duration}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
                <Link href={g.c === "dubai" ? "/dubai-package/" : "/thailand-package/"} className="mt-6 inline-flex items-center gap-2 self-start font-semibold text-navy link-underline">
                  All {g.pkgs.length} {g.c === "dubai" ? "Dubai" : "Thailand"} packages <ArrowRight className="size-4" aria-hidden />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Bike trips — the company's own gallery, motorcycles and road-trip guides
// ---------------------------------------------------------------------------
export function BikeTrips() {
  const shots = gallery.images.slice(0, 4);
  const bikes = equipment.groups.find((g) => /motorcycle/i.test(g.title))?.items.length ?? 0;
  return (
    <section className="bg-ivory py-24 md:py-28" aria-labelledby="bike-title">
      <div className="container-x">
        <div className="grid gap-8 lg:grid-cols-[1fr_1.3fr] lg:items-end">
          <div>
            <p className="eyebrow !text-sand-deep">Bike trips</p>
            <h2 id="bike-title" className="mt-3 text-display-md text-balance">Ride out of Delhi.</h2>
          </div>
          <p className="max-w-2xl text-lede text-ink/75">
            Group rides and road trips from Delhi, Gurgaon and Noida — {bikes} motorcycles and a full range of riding gear, with {roadTrips.trips.length} road-trip guides to Rishikesh, Neemrana, Sariska and beyond.
          </p>
        </div>
        <ul className="mt-12 grid grid-cols-2 gap-3 md:grid-cols-4">
          {shots.map((src, i) => (
            <li key={src} className={i % 2 ? "md:translate-y-8" : ""}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`NUAB group ride, photograph ${i + 1}`} loading="lazy" className="aspect-[4/5] w-full object-cover" />
            </li>
          ))}
        </ul>
        <div className="mt-16 flex flex-wrap gap-x-8 gap-y-3 font-semibold text-navy">
          <Link href="/gallery/" className="link-underline">Gallery</Link>
          <Link href="/equipment-safety-gear/" className="link-underline">Motorcycles & safety gear</Link>
          <Link href="/destinations/#road-trips" className="link-underline">Road-trip guides</Link>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Company & trust (claims are quoted as NUAB states them on its site)
// ---------------------------------------------------------------------------
const TRUST_ICONS = { users: Users, badge: BadgeCheck, headset: Headphones, star: Star } as const;

export function Company() {
  return (
    <section className="bg-white py-24 md:py-32" aria-labelledby="company-title">
      <div className="container-x">
        <div className="grid gap-14 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <p className="eyebrow">Why book with NUAB Tourism</p>
            <h2 id="company-title" className="mt-3 text-display-md text-balance">Built in Gurugram. Led by experience.</h2>
            <p className="mt-6 text-lede text-ink/80">{home.aboutParas[0]}</p>
            <p className="mt-4 text-ink/75">{home.aboutParas[1]}</p>
            <Link href="/about/" className="mt-8 inline-flex items-center gap-2 font-semibold text-navy link-underline">About NUAB Tourism <ArrowRight className="size-4" aria-hidden /></Link>
          </div>
          <div className="relative">
            {about.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={about.image} alt="IATA Certificate of Accreditation issued to NUAB Enterprises Private Limited" loading="lazy" className="aspect-[4/3] w-full border border-line object-contain bg-white" />
            )}
            <Engraving id="india-gate" className="absolute -bottom-10 -left-8 hidden w-44 bg-white p-3 text-stone lg:block" />
          </div>
        </div>

        <ol className="mt-20 grid gap-px bg-line md:grid-cols-3">
          {home.whyBook.map((w, i) => (
            <li key={w.title} className="bg-white p-6 md:p-8">
              <span className="font-mono text-[0.7rem] text-stone">0{i + 1}</span>
              <h3 className="mt-3 font-display text-2xl">{w.title}</h3>
              <p className="mt-3 text-[0.95rem] leading-relaxed text-ink/75">{w.text}</p>
            </li>
          ))}
        </ol>

        <ul className="mt-px grid grid-cols-2 gap-px bg-line md:grid-cols-4">
          {home.trust.map((t) => {
            const Icon = TRUST_ICONS[t.icon as keyof typeof TRUST_ICONS] ?? Star;
            return (
              <li key={t.label} className="flex items-center gap-3 bg-mist p-5">
                <Icon className="size-5 shrink-0 text-navy" aria-hidden />
                <span className="text-[0.9rem] font-medium text-ink">{t.label}</span>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 font-mono text-[0.62rem] uppercase tracking-[0.1em] text-muted">Figures as published by NUAB Tourism</p>

        <div className="mt-24">
          <p className="eyebrow">{home.tagline}</p>
          <ul className="mt-8 grid gap-10 md:grid-cols-3">
            {home.testimonials.map((t) => (
              <li key={t.name}>
                <figure>
                  <blockquote className="font-display text-[1.25rem] leading-snug text-navy">“{t.quote.split(". ")[0]}.”</blockquote>
                  <p className="mt-3 text-[0.92rem] text-ink/70">{t.quote.split(". ").slice(1).join(". ")}</p>
                  <figcaption className="mt-4 font-mono text-[0.68rem] uppercase tracking-[0.12em] text-muted">{t.name} — {t.title}</figcaption>
                </figure>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Booking & contact
// ---------------------------------------------------------------------------
export function ContactBand() {
  return (
    <section className="sky-hero-soft relative overflow-hidden py-24" aria-labelledby="contact-band">
      <Engraving id="himalaya" className="pointer-events-none absolute -bottom-6 right-0 hidden w-[44rem] text-navy/20 lg:block" />
      <div className="container-x relative grid gap-12 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <p className="eyebrow !text-navy/70">Speak to a travel consultant</p>
          <h2 id="contact-band" className="mt-3 text-display-md text-balance">Tell us where you’d like to go.</h2>
          <p className="mt-5 max-w-xl text-lede text-ink/75">Call, WhatsApp or email the Gurugram office — {SITE.hours.toLowerCase()}. Same-day tours can also be booked directly online.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <EnquireButton className="btn btn-primary" subject="A new journey">Plan my trip</EnquireButton>
            <a href={whatsappLink("Hello NUAB Tourism, I would like to plan a trip.")} target="_blank" rel="noopener noreferrer" className="btn btn-ghost bg-white/70">WhatsApp us</a>
            <a href={SITE.bookingSite} target="_blank" rel="noopener noreferrer" className="btn btn-ghost bg-white/70">Book online <ArrowUpRight className="size-4" aria-hidden /></a>
          </div>
        </div>
        <address className="not-italic">
          <ul className="divide-y divide-navy/15 border-y border-navy/15 text-[0.98rem]">
            {SITE.phones.map((p) => (
              <li key={p.tel}><a href={`tel:${p.tel}`} className="flex items-center gap-3 py-4 font-semibold text-navy hover:underline"><Phone className="size-4" aria-hidden /> {p.display}</a></li>
            ))}
            <li><a href={`mailto:${SITE.email}`} className="flex items-center gap-3 break-all py-4 text-navy hover:underline"><Mail className="size-4 shrink-0" aria-hidden /> {SITE.email}</a></li>
            <li><a href={SITE.mapsUrl} target="_blank" rel="noopener noreferrer" className="flex items-start gap-3 py-4 text-ink hover:text-navy"><MapPin className="mt-1 size-4 shrink-0" aria-hidden /> {SITE.address.full}</a></li>
          </ul>
        </address>
      </div>
    </section>
  );
}
