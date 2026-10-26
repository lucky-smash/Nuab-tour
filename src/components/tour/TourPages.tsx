import Link from "next/link";
import { ArrowUpRight, Clock, MapPin, Phone, Route, Users } from "lucide-react";
import { type CabPage, type DayTour, type MultiDayTour, dayTours, multiDayTours } from "@/data";
import { SITE, formatCoord, formatINR, whatsappLink } from "@/lib/site";
import { CheckList, DataTable, FaqList, Itinerary, LinkRows, PageHeader, Section } from "@/components/page/Blocks";
import { EnquireButton } from "@/components/ui/Enquiry";
import { Engraving } from "@/components/engraving/Engraving";
import { tourVisual } from "./tourMeta";
import { destinations } from "@/data/destinations";

function credit(p?: { author: string; license: string; sourceUrl: string }) {
  return p ? { text: `Photo: ${p.author} · ${p.license}`, href: p.sourceUrl } : null;
}

function BookingAside({ title, price, basis, booking, note }: { title: string; price: string | null; basis: string | null; booking?: string | null; note?: string }) {
  return (
    <aside className="border border-line bg-white p-6 lg:sticky lg:top-28">
      <p className="font-mono text-[0.64rem] uppercase tracking-[0.14em] text-stone">Fare</p>
      {price ? (
        <p className="mt-2 font-display text-4xl text-navy">{price}<span className="ml-2 font-sans text-sm text-muted">{basis}</span></p>
      ) : (
        <p className="mt-2 font-display text-2xl text-navy">Price on enquiry</p>
      )}
      {note && <p className="mt-2 text-sm text-muted">{note}</p>}
      <div className="mt-6 flex flex-col gap-2.5">
        {booking ? (
          <a href={booking} target="_blank" rel="noopener noreferrer" className="btn btn-primary w-full">Book online <ArrowUpRight className="size-4" aria-hidden /></a>
        ) : null}
        <EnquireButton subject={title} className={booking ? "btn btn-ghost w-full" : "btn btn-primary w-full"}>Enquire now</EnquireButton>
        <a href={whatsappLink(`Hello NUAB Tourism, I would like to book: ${title}`)} target="_blank" rel="noopener noreferrer" className="btn btn-ghost w-full">WhatsApp</a>
      </div>
      <div className="mt-6 space-y-1.5 border-t border-line pt-5 text-sm">
        {SITE.phones.map((p) => (
          <a key={p.tel} href={`tel:${p.tel}`} className="flex items-center gap-2 font-semibold text-navy"><Phone className="size-3.5" aria-hidden /> {p.display}</a>
        ))}
      </div>
    </aside>
  );
}

// ===========================================================================
// Same-day tours (car & bus)
// ===========================================================================
export function DayTourPage({ t }: { t: DayTour }) {
  const v = tourVisual(t);
  const sibling = dayTours.find((x) => x.slug !== t.slug && x.title.replace(/ by (Car|Bus)$/, "") === t.title.replace(/ by (Car|Bus)$/, ""));
  const related = multiDayTours.filter((m) => new RegExp(t.title.split(" ")[0], "i").test(m.title + m.itinerary.map((d) => d.title).join(" "))).slice(0, 4);
  const isCar = t.mode === "car";
  const fareRows = t.fares.length
    ? t.fares.map((f) =>
        isCar
          ? [f.vehicle, f.capacity ?? "—", <span key="p" className="font-semibold">{formatINR(f.fare)}</span>, t.bookingLink ? <a key="b" href={t.bookingLink} target="_blank" rel="noopener noreferrer" className="link-underline font-semibold text-navy">Book</a> : <span key="b" className="text-muted">Enquire</span>]
          : [f.vehicle, f.departure ?? "—", f.returnTime ?? "—", <span key="p" className="font-semibold">{formatINR(f.fare)}</span>, t.bookingLink ? <a key="b" href={t.bookingLink} target="_blank" rel="noopener noreferrer" className="link-underline font-semibold text-navy">Book</a> : "Enquire"],
      )
    : [];

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Tours", href: "/tours/" }, { label: t.title }]}
        coord={`${formatCoord(v.coord[0], "lat")} · ${formatCoord(v.coord[1], "lng")} — ${v.place}`}
        eyebrow={isCar ? "Same-day tour · private AC car" : "Same-day tour · seat in coach"}
        title={t.title}
        lede={t.tagline}
        image={v.photoData?.src}
        imageAlt={v.photoData?.alt}
        imageCredit={credit(v.photoData)}
      >
        <ul className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
          <li className="flex items-center gap-2"><Clock className="size-4 text-stone" aria-hidden /> {t.durationText === "Full day" ? "Full day" : `Full day · ${t.durationText}`}</li>
          {t.startTime && <li className="flex items-center gap-2"><Route className="size-4 text-stone" aria-hidden /> Recommended start {t.startTime}</li>}
          <li className="flex items-center gap-2"><Users className="size-4 text-stone" aria-hidden /> Priced {t.fareUnit}</li>
        </ul>
      </PageHeader>

      <div className="container-x grid gap-14 py-16 lg:grid-cols-[1fr_20rem] lg:py-20">
        <div className="min-w-0 space-y-16">
          <section>
            {t.introHeading && <h2 className="text-display-sm">{t.introHeading.replace(/:-$/, "")}</h2>}
            <div className="prose-atlas mt-4">{t.introParas.map((p, i) => <p key={i}>{p}</p>)}</div>
          </section>

          {t.places.length > 0 && (
            <section>
              <h2 className="text-display-sm">Places covered</h2>
              <ol className="tile-grid tile-grid-tight mt-6 sm:grid-cols-2">
                {t.places.map((p, i) => (
                  <li key={p} className="tile !flex-row items-baseline gap-4 px-5 py-4">
                    <span className="font-mono text-[0.7rem] text-stone">{String(i + 1).padStart(2, "0")}</span>
                    <span className="font-display text-lg text-navy">{p}</span>
                  </li>
                ))}
              </ol>
              {t.notes.length > 0 && <ul className="mt-4 space-y-1 text-sm text-muted">{t.notes.map((n) => <li key={n}>{n}</li>)}</ul>}
            </section>
          )}

          {t.attractions.length > 0 && (
            <section>
              <h2 className="text-display-sm">The sights</h2>
              <div className="mt-6 grid gap-x-10 gap-y-8 md:grid-cols-2">
                {t.attractions.map((a) => (
                  <article key={a.name}>
                    <h3 className="font-display text-xl text-navy">{a.name}</h3>
                    <p className="mt-2 text-[0.95rem] leading-relaxed text-ink/80">{a.text}</p>
                  </article>
                ))}
              </div>
            </section>
          )}

          <section id="fares">
            <h2 className="text-display-sm">{isCar ? "Fares by vehicle" : "Coach departures & fares"}</h2>
            <div className="mt-6">
              {fareRows.length ? (
                <DataTable head={isCar ? ["Car type", "Capacity", "Fare", "Booking"] : ["Coach", "Departure", "Return", "Fare", "Booking"]} rows={fareRows} caption={isCar ? "Fare per vehicle, round trip from Delhi" : "Fare per seat"} />
              ) : (
                <p className="text-ink/80">{t.fromPrice ? <>Seat-in-coach fare: <strong>{formatINR(t.fromPrice)}</strong> per seat.</> : "Fares on enquiry."}</p>
              )}
            </div>
            <div className="mt-10 grid gap-10 md:grid-cols-2">
              <div>
                <h3 className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-stone">Included</h3>
                <div className="mt-4"><CheckList items={t.inclusions} /></div>
              </div>
              <div>
                <h3 className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-stone">Not included</h3>
                <div className="mt-4"><CheckList items={t.exclusions} kind="exclude" /></div>
              </div>
            </div>
          </section>

          <FaqList faqs={t.faqs} />
        </div>
        <div>
          <BookingAside title={t.title} price={t.fromPrice ? `${formatINR(t.fromPrice)}` : null} basis={t.fromPrice ? `from, ${t.fareUnit}` : null} booking={t.bookingLink} />
          <Engraving id={v.engraving} className="mt-10 hidden w-full text-stone/70 lg:block" />
        </div>
      </div>

      {(sibling || related.length > 0) && (
        <Section tone="mist" eyebrow="Also from Delhi" title="Related journeys">
          <LinkRows
            items={[
              ...(sibling ? [{ title: sibling.title, href: sibling.path, meta: sibling.mode === "car" ? "Same-day · private car" : "Same-day · seat in coach", right: sibling.fromPrice ? `from ${formatINR(sibling.fromPrice)}` : undefined, rightSub: sibling.fareUnit }] : []),
              ...related.map((m) => ({ title: m.title, href: m.path, meta: m.durationText, right: m.fromPrice ? `from ${formatINR(m.fromPrice)}` : "On enquiry", rightSub: m.pricing?.basis })),
            ]}
          />
        </Section>
      )}
    </>
  );
}

// ===========================================================================
// Multi-day packages
// ===========================================================================
export function MultiDayPage({ t }: { t: MultiDayTour }) {
  const v = tourVisual(t);
  const others = multiDayTours.filter((m) => m.slug !== t.slug);
  return (
    <>
      <PageHeader
        crumbs={[{ label: "Tours", href: "/tours/" }, { label: "Golden Triangle", href: "/tours/#multi-day" }, { label: t.title }]}
        coord={`${formatCoord(v.coord[0], "lat")} · ${formatCoord(v.coord[1], "lng")} — ${v.place}`}
        eyebrow={`Multi-day package · ${t.durationText}`}
        title={t.headline && t.headline.length < 90 ? t.headline : t.title}
        image={v.photoData?.src}
        imageAlt={v.photoData?.alt}
        imageCredit={credit(v.photoData)}
      >
        <ul className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
          <li className="flex items-center gap-2"><Clock className="size-4 text-stone" aria-hidden /> {t.durationText}</li>
          <li className="flex items-center gap-2"><MapPin className="size-4 text-stone" aria-hidden /> Starts & ends in Delhi</li>
          {t.pricing && <li className="flex items-center gap-2"><Users className="size-4 text-stone" aria-hidden /> Priced {t.pricing.basis}</li>}
        </ul>
      </PageHeader>

      <div className="container-x grid gap-14 py-16 lg:grid-cols-[1fr_20rem] lg:py-20">
        <div className="min-w-0 space-y-16">
          {t.introParas.length > 0 && <div className="prose-atlas">{t.introParas.map((p, i) => <p key={i}>{p}</p>)}</div>}

          {t.highlights.length > 0 && (
            <section>
              <h2 className="text-display-sm">Highlights</h2>
              <ul className="tile-grid tile-grid-tight mt-6 md:grid-cols-2">
                {t.highlights.map((h) => <li key={h} className="tile px-5 py-4 text-[0.95rem] text-ink/85">{h}</li>)}
              </ul>
            </section>
          )}

          {t.itinerary.length > 0 && (
            <section>
              <h2 className="text-display-sm">Day by day</h2>
              <div className="mt-8 pl-5"><Itinerary days={t.itinerary} /></div>
            </section>
          )}

          {t.pricing && (
            <section id="fares">
              <h2 className="text-display-sm">Price</h2>
              <div className="mt-6">
                {t.pricing.basis === "per person" ? (
                  <DataTable head={["Group size", "Vehicle", "Price per person"]} rows={t.pricing.rows.map((r) => [`${r.adults} adults`, r.vehicle ?? "—", <span key="p" className="font-semibold">{formatINR(r.price)}</span>])} caption="Based on adults travelling together" />
                ) : (
                  <DataTable head={["Vehicle", "Seating", "Fare"]} rows={t.pricing.rows.map((r) => [r.vehicle ?? r.label, r.seating ?? "—", <span key="p" className="font-semibold">{formatINR(r.price)}</span>])} caption="Fare per vehicle as published" />
                )}
                {t.pricing.note && <p className="mt-3 text-sm text-muted">*{t.pricing.note}</p>}
              </div>
            </section>
          )}

          {t.temples.length > 0 && (
            <section>
              <h2 className="text-display-sm">Temples covered</h2>
              <ul className="mt-6 flex flex-wrap gap-2">
                {[...new Set(t.temples)].map((x) => <li key={x} className="border border-line px-3 py-1.5 text-sm">{x}</li>)}
              </ul>
            </section>
          )}

          {(t.inclusions.length > 0 || t.exclusions.length > 0) && (
            <section className="grid gap-10 md:grid-cols-2">
              <div>
                <h2 className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-stone">Package inclusions</h2>
                <div className="mt-4"><CheckList items={t.inclusions} /></div>
              </div>
              <div>
                <h2 className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-stone">Package exclusions</h2>
                <div className="mt-4"><CheckList items={t.exclusions} kind="exclude" /></div>
              </div>
            </section>
          )}

          {t.restaurants.length > 0 && (
            <section>
              <h2 className="text-display-sm">Where to eat</h2>
              <ul className="mt-5 grid gap-x-8 gap-y-2 text-[0.95rem] md:grid-cols-2">
                {t.restaurants.map((r) => { const [n, d] = r.split(" - "); return <li key={r}><strong className="font-semibold text-navy">{n}</strong>{d && <span className="text-muted"> — {d}</span>}</li>; })}
              </ul>
            </section>
          )}

          <FaqList faqs={t.faqs} />
        </div>
        <div>
          <BookingAside title={t.title} price={t.fromPrice ? formatINR(t.fromPrice) : null} basis={t.fromPrice ? `from, ${t.pricing?.basis}` : null} note={t.pricing ? undefined : "This package is quoted on request for your dates and group size."} />
          <Engraving id={v.engraving} className="mt-10 hidden w-full text-stone/70 lg:block" />
        </div>
      </div>

      <Section tone="mist" eyebrow="Golden Triangle & pilgrimage" title="Other multi-day packages">
        <LinkRows items={others.map((m) => ({ title: m.title, href: m.path, meta: m.durationText, right: m.fromPrice ? `from ${formatINR(m.fromPrice)}` : "On enquiry", rightSub: m.pricing?.basis }))} />
      </Section>
    </>
  );
}

// ===========================================================================
// Outstation cabs
// ===========================================================================
export function CabPageView({ c }: { c: CabPage }) {
  const region = c.title.replace(/^Delhi to /, "").replace(/ Cabs$/, "");
  const engraving = /Uttarakhand/.test(c.title) ? "jhula" : "himalaya";
  const destIds = new Map(destinations.map((d) => [d.name.toLowerCase(), d.id] as const));
  destIds.set("chhota", "chopta");
  return (
    <>
      <PageHeader
        crumbs={[{ label: "Outstation cabs", href: "/tours/#cabs" }, { label: c.title }]}
        eyebrow="Outstation cabs from Delhi · 24×7"
        title={c.title}
        lede={c.intro}
        engraving={engraving}
      >
        <div className="flex flex-wrap gap-3">
          <a href={whatsappLink(`Hello NUAB Tourism, I want to book a Delhi to ${region} cab.`)} target="_blank" rel="noopener noreferrer" className="btn btn-primary">Book on WhatsApp</a>
          <a href={`tel:${SITE.phones[0].tel}`} className="btn btn-ghost bg-white/70"><Phone className="size-4" aria-hidden /> {SITE.phones[0].display}</a>
        </div>
      </PageHeader>
      <Section eyebrow={`${c.routes.length} routes · from ₹10/km`} title={`Delhi to ${region} by road`}>
        <ul className="tile-grid md:grid-cols-2 xl:grid-cols-3">
          {c.routes.map((r) => {
            const id = destIds.get(r.to.toLowerCase());
            return (
              <li key={r.id} id={r.id} className="tile p-6">
                <p className="font-mono text-[0.64rem] uppercase tracking-[0.14em] text-stone">{r.from} → {r.to}</p>
                <h3 className="mt-2 font-display text-2xl text-navy">{r.to === "Chhota" ? "Chhota (Chopta)" : r.to}</h3>
                <dl className="mt-4 grid grid-cols-3 gap-3 border-y border-line py-3 text-sm">
                  <div><dt className="font-mono text-[0.6rem] uppercase tracking-[0.1em] text-muted">Distance</dt><dd className="mt-0.5 font-semibold">{r.distanceLabel}</dd></div>
                  <div><dt className="font-mono text-[0.6rem] uppercase tracking-[0.1em] text-muted">Time</dt><dd className="mt-0.5 font-semibold">{r.travelTime}</dd></div>
                  <div><dt className="font-mono text-[0.6rem] uppercase tracking-[0.1em] text-muted">Fare</dt><dd className="mt-0.5 font-semibold">{r.fareLabel}</dd></div>
                </dl>
                {r.routeVia && (
                  <div className="mt-4">
                    <p className="text-[0.8rem] text-muted">Road route via {r.routeVia} (as published)</p>
                    <ol className="mt-2 flex flex-wrap items-center gap-1.5 font-mono text-[0.66rem] uppercase tracking-[0.08em] text-ink">
                      {r.waypoints.map((w, i) => (
                        <li key={w + i} className="flex items-center gap-1.5">{i > 0 && <span className="text-stone">—</span>}{w}</li>
                      ))}
                    </ol>
                  </div>
                )}
                <p className="mt-4 flex-1 text-[0.9rem] text-ink/75">{r.paras[0]}</p>
                <div className="tile-cta flex flex-wrap gap-4 text-sm">
                  <a href={r.whatsapp} target="_blank" rel="noopener noreferrer" className="link-underline font-semibold text-navy">Book on WhatsApp</a>
                  {id && <Link href={`/destinations/${id}/`} className="link-underline text-muted">About {r.to}</Link>}
                </div>
              </li>
            );
          })}
        </ul>
        <p className="mt-6 text-sm text-muted">Distances and travel times are approximate, as published by NUAB Tourism. Taxi fare starts from ₹10 per km; the final quote depends on vehicle, trip type (one-way or round trip) and dates.</p>
      </Section>
      <Section tone="mist" eyebrow="Other regions" title="More outstation cabs">
        <LinkRows items={[
          { title: "Delhi to Himachal Cabs", href: "/delhi-to-himachal-cabs/", meta: "Shimla · Manali · Dharamshala · Kasol · Dalhousie" },
          { title: "Delhi to Uttarakhand Cabs", href: "/delhi-to-uttarakhand-cabs/", meta: "Dehradun · Mussoorie · Nainital · Jim Corbett" },
          { title: "Delhi to Vaishno Devi Cabs", href: "/delhi-to-vaishno-devi-cabs/", meta: "Jammu · Katra · Vaishno Devi" },
        ].filter((x) => x.href !== c.path)} />
      </Section>
    </>
  );
}

