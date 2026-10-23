import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Car } from "lucide-react";
import { destinations, destinationById } from "@/data/destinations";
import { photo } from "@/data";
import { SITE, formatCoord, formatINR } from "@/lib/site";
import { LinkRows, PageHeader, Section } from "@/components/page/Blocks";
import { Locator } from "@/components/page/Locator";
import { EnquireButton } from "@/components/ui/Enquiry";
import { buildAtlasData } from "@/components/map/atlasData";

export const dynamicParams = false;
export function generateStaticParams() {
  return destinations.map((d) => ({ id: d.id }));
}

const km = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const R = 6371, dLat = ((b.lat - a.lat) * Math.PI) / 180, dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const d = destinationById(id);
  if (!d) return {};
  return {
    title: `${d.name} — Tours, Cabs & Travel Guide`,
    description: (d.summary || `${d.name}, ${d.region}: tours, fares and travel information from NUAB Tourism.`).slice(0, 158),
    alternates: { canonical: `/destinations/${d.id}/` },
  };
}

export default async function DestinationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = destinationById(id);
  if (!d) notFound();
  const atlas = buildAtlasData().find((a) => a.id === d.id)!;
  const ph = photo(d.photo);
  const neighbours = destinations.filter((n) => n.id !== d.id && n.country === d.country).map((n) => ({ n, dist: km(d, n) })).sort((a, b) => a.dist - b.dist).slice(0, 6);
  const image = ph?.src ?? atlas.image?.src ?? null;
  const ld = { "@context": "https://schema.org", "@type": "TouristDestination", name: d.name, geo: { "@type": "GeoCoordinates", latitude: d.lat, longitude: d.lng }, containedInPlace: d.region, url: SITE.url + `/destinations/${d.id}/` };

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Destinations", href: "/destinations/" }, { label: d.name }]}
        coord={`${formatCoord(d.lat, "lat")} · ${formatCoord(d.lng, "lng")} — ${d.region.toUpperCase()}`}
        eyebrow={[d.country === "India" ? null : d.country, atlas.distanceLabel].filter(Boolean).join(" · ") || undefined}
        title={d.sourceName ? `${d.name} (${d.sourceName})` : d.name}
        lede={atlas.summary}
        image={image}
        imageAlt={ph?.alt ?? d.name}
        imageCredit={ph ? { text: `Photo: ${ph.author} · ${ph.license}`, href: ph.sourceUrl } : null}
      >
        <div className="flex flex-wrap gap-3">
          <EnquireButton subject={`Travel to ${d.name}`} className="btn btn-primary">Enquire about {d.name}</EnquireButton>
          <Link href={`/destinations/?d=${d.id}#atlas`} className="btn btn-ghost bg-white/70">View on the atlas</Link>
        </div>
      </PageHeader>

      <div className="container-x grid gap-14 py-16 lg:grid-cols-[1fr_22rem] lg:py-20">
        <div className="min-w-0 space-y-16">
          {atlas.attractions.length > 0 && (
            <section>
              <h2 className="text-display-sm">Highlights</h2>
              <ul className="mt-5 flex flex-wrap gap-2">
                {atlas.attractions.map((a) => <li key={a} className="border border-line px-3 py-1.5 text-[0.92rem]">{a}</li>)}
              </ul>
            </section>
          )}

          {d.tours.length > 0 && (
            <section>
              <h2 className="text-display-sm">Tours that visit {d.name}</h2>
              <div className="mt-6">
                <LinkRows items={atlas.tours.concat([]).map((t) => ({ title: t.title, href: t.href, meta: `${t.kind} · ${t.duration}`, right: t.price ?? "On enquiry", rightSub: t.basis ?? undefined }))} />
                {d.tours.length > atlas.tours.length && (
                  <ul className="mt-3 text-sm text-muted">
                    {d.tours.slice(atlas.tours.length).map((t) => <li key={t.slug}><Link className="link-underline" href={t.path}>{t.title}</Link>{t.fromPrice ? ` — from ${formatINR(t.fromPrice)}` : ""}</li>)}
                  </ul>
                )}
              </div>
            </section>
          )}

          {d.cabs.length > 0 && (
            <section>
              <h2 className="text-display-sm">By outstation cab</h2>
              <ul className="mt-6 grid gap-px bg-line sm:grid-cols-2">
                {d.cabs.map((c) => (
                  <li key={c.id} className="bg-white p-5">
                    <p className="flex items-center gap-2 font-semibold text-navy"><Car className="size-4" aria-hidden /> {c.from} to {c.to}</p>
                    <p className="mt-1 font-mono text-[0.64rem] uppercase tracking-[0.1em] text-muted">{c.distanceLabel} · approx. {c.travelTime} · {c.fareLabel}</p>
                    {c.routeVia && <p className="mt-3 text-sm text-ink/75">Via {c.routeVia}: {c.waypoints.join(" — ")}</p>}
                    <div className="mt-4 flex gap-4 text-sm">
                      <a href={c.whatsapp} target="_blank" rel="noopener noreferrer" className="link-underline font-semibold text-navy">Book on WhatsApp</a>
                      <Link href={`${c.page.path}#${c.id}`} className="link-underline text-muted">{c.page.title}</Link>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {d.roadTrip && (
            <section id="road-trip" className="scroll-mt-28">
              <p className="eyebrow">Road-trip guide</p>
              <h2 className="mt-2 text-display-sm">{d.roadTrip.title}{d.roadTrip.distanceLabel ? ` (${d.roadTrip.distanceLabel})` : ""}</h2>
              <div className="prose-atlas mt-5">
                {d.roadTrip.paras.map((p, i) => <p key={i}>{p.replace(/\*+/g, "")}</p>)}
              </div>
            </section>
          )}

          {d.packages.length > 0 && (
            <section>
              <h2 className="text-display-sm">Holiday packages including {d.name}</h2>
              <div className="mt-6">
                <LinkRows items={d.packages.map((p) => ({ title: p.title, href: p.path, meta: p.duration ?? "", right: "On enquiry" }))} />
              </div>
            </section>
          )}

          {!d.tours.length && !d.cabs.length && !d.roadTrip && !d.packages.length && (
            <p className="text-ink/75">Ask our consultants about travelling to {d.name}.</p>
          )}
        </div>

        <aside className="space-y-8 lg:sticky lg:top-28 lg:self-start">
          <Locator d={d} neighbours={neighbours.map((x) => x.n)} />
          <div>
            <p className="font-mono text-[0.64rem] uppercase tracking-[0.14em] text-stone">Nearby on the atlas</p>
            <ul className="mt-3 divide-y divide-line border-y border-line">
              {neighbours.map(({ n, dist }) => (
                <li key={n.id}>
                  <Link href={`/destinations/${n.id}/`} className="flex items-baseline justify-between py-2.5 text-[0.92rem] hover:text-navy">
                    <span className="font-semibold text-navy">{n.name}</span>
                    <span className="font-mono text-[0.62rem] uppercase tracking-[0.08em] text-muted">{Math.round(dist)} km away*</span>
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[0.7rem] text-muted">*Straight-line distance, not road distance.</p>
          </div>
          <Link href="/destinations/" className="inline-flex items-center gap-2 text-sm font-semibold text-navy link-underline">All destinations <ArrowRight className="size-4" aria-hidden /></Link>
        </aside>
      </div>

      {d.summarySource && d.summarySource.startsWith("/") && (
        <Section tone="mist">
          <p className="text-sm text-muted">Description from NUAB’s <Link className="link-underline text-navy" href={d.summarySource.split("#")[0]}>{d.summarySource.includes("road-trips") ? "road-trip guides" : "tour page"}</Link>.</p>
        </Section>
      )}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
    </>
  );
}
