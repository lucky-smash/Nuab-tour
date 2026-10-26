import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { destinations, destinationById } from "@/data/destinations";
import { intlPackages, photo } from "@/data";
import { formatCoord, formatINR, clsx } from "@/lib/site";

/** Slow ticker of every destination at its true coordinates (static under reduced motion). */
export function CoordinateTicker() {
  const items = destinations.map((d) => ({ name: d.name, coord: `${formatCoord(d.lat, "lat")} ${formatCoord(d.lng, "lng")}` }));
  const row = (hidden: boolean) => (
    <ul className="flex shrink-0 items-center" aria-hidden={hidden || undefined}>
      {items.map((it) => (
        <li key={it.name} className="flex items-center gap-3 px-6">
          <span className="font-display text-[1.05rem] italic text-white">{it.name}</span>
          <span className="font-mono text-[0.66rem] tracking-[0.1em] text-sand">{it.coord}</span>
          <span aria-hidden className="ml-6 size-1 rounded-full bg-coral" />
        </li>
      ))}
    </ul>
  );
  return (
    <section aria-label="Destinations at their coordinates" className="ticker overflow-hidden border-y border-white/10 bg-midnight py-4">
      <div className="ticker-track">
        {row(false)}
        {row(true)}
      </div>
    </section>
  );
}

type Tile = { id: string; title: string; tag: string; meta: string; href: string; img?: { src: string; srcSet?: string; alt: string; credit: string; url?: string }; span: string; tall?: boolean };

function tiles(): Tile[] {
  const T = (id: string, title: string, tag: string, photoId: string, span: string, tall = false): Tile => {
    const d = destinationById(id)!;
    const ph = photo(photoId);
    // price from the destination's own tours (a tour that merely passes through doesn't count)
    const key = title.split(/[ –]/)[0].toLowerCase();
    const own = d.tours.filter((t) => t.title.toLowerCase().includes(key) && t.fromPrice != null).sort((a, b) => (a.fromPrice ?? 0) - (b.fromPrice ?? 0))[0];
    const basis = own ? (own.kind === "same-day" ? own.fareUnit : own.pricing?.basis ?? "") : "";
    const price = own ? `From ${formatINR(own.fromPrice)} ${basis}`.trim() : `${d.tours.length} tours`;
    return { id, title, tag, meta: price, href: `/destinations/${id}/`, img: ph && { src: ph.src, srcSet: ph.srcSet, alt: ph.alt || title, credit: `${ph.author} · ${ph.license}`, url: ph.sourceUrl }, span, tall };
  };
  const intl = (country: "dubai" | "thailand", photoId: string, span: string): Tile => {
    const ph = photo(photoId);
    const n = intlPackages.filter((p) => p.country === country).length;
    return {
      id: country,
      title: country === "dubai" ? "Dubai & the Emirates" : "Thailand",
      tag: "Beyond India",
      meta: `${n} holiday packages`,
      href: country === "dubai" ? "/dubai-package/" : "/thailand-package/",
      img: ph && { src: ph.src, srcSet: ph.srcSet, alt: ph.alt || country, credit: `${ph.author} · ${ph.license}`, url: ph.sourceUrl },
      span,
    };
  };
  return [
    T("agra", "Agra", "The Taj at sunrise", "agra-taj-mahal", "md:col-span-7 md:row-span-2", true),
    T("jaipur", "Jaipur", "The Pink City", "jaipur-hawa-mahal", "md:col-span-5"),
    T("vrindavan", "Mathura – Vrindavan", "Krishna’s Braj", "vrindavan-prem-mandir", "md:col-span-5"),
    T("rishikesh", "Haridwar – Rishikesh", "Ganga Aarti & the foothills", "rishikesh-laxman-jhula", "md:col-span-4"),
    T("delhi", "Delhi", "Where every journey starts", "delhi-qutub-minar", "md:col-span-4"),
    intl("dubai", "dubai-skyline", "md:col-span-4"),
    intl("thailand", "bangkok-wat-arun", "md:col-span-12 lg:col-span-12"),
  ];
}

/** Asymmetric, photo-led index of featured destinations. */
export function FeaturedDestinations() {
  const list = tiles();
  return (
    <section className="bg-white py-24 md:py-28" aria-labelledby="dest-title">
      <div className="container-x">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="eyebrow !text-coral">Pick your next stop</p>
            <h2 id="dest-title" className="mt-3 text-display-md text-balance">Where to first?</h2>
          </div>
          <Link href="/destinations/" className="nudge inline-flex items-center gap-2 font-semibold text-navy link-underline">
            All {destinations.length} destinations <ArrowUpRight className="size-4" aria-hidden />
          </Link>
        </div>
        <ul className="mt-12 grid grid-cols-1 gap-6 md:auto-rows-[17rem] md:grid-cols-12 md:gap-8">
          {list.map((t, i) => (
            <li key={t.id} className={clsx("min-h-[17rem] md:min-h-0", t.span, t.id === "thailand" && "md:!row-span-1")}>
              <Link href={t.href} className="group relative flex h-full overflow-hidden bg-midnight">
                {t.img && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={t.img.src} srcSet={t.img.srcSet} sizes="(min-width: 768px) 60vw, 100vw" alt={t.img.alt} loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-[cubic-bezier(.22,.61,.36,1)] group-hover:scale-[1.04]" />
                )}
                {/* solid-enough base for text: gradient from midnight at the bottom */}
                <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-midnight/90 via-midnight/25 to-transparent" />
                <span className="relative mt-auto flex w-full items-end justify-between gap-4 p-5 md:p-6">
                  <span>
                    <span className="flex items-center gap-2">
                      <span className="index-num text-[1.4rem] !text-sand">{String(i + 1).padStart(2, "0")}</span>
                      <span className="pill !border-white/30 !bg-white/12 !py-0.5 !text-[0.7rem] !text-white backdrop-blur-sm">{t.tag}</span>
                    </span>
                    <span className={clsx("mt-2 block font-display leading-none text-white", t.tall ? "text-[clamp(2.4rem,4vw,3.6rem)]" : "text-[clamp(1.7rem,2.6vw,2.3rem)]")}>{t.title}</span>
                    <span className="mt-2 block text-[0.85rem] font-semibold text-white/85">{t.meta}</span>
                  </span>
                  <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white text-navy transition-transform duration-300 group-hover:rotate-45">
                    <ArrowUpRight className="size-4" />
                  </span>
                </span>
                {t.img && <span className="absolute right-3 top-3 max-w-[60%] truncate font-mono text-[0.55rem] uppercase tracking-wide text-white/70">{t.img.credit}</span>}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
