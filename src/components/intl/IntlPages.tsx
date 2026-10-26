import Link from "next/link";
import { ArrowRight, Clock, MapPin } from "lucide-react";
import { intlLandings, intlPackages, photo, type IntlPackage } from "@/data";
import { CheckList, FaqList, LinkRows, PageHeader, Section } from "@/components/page/Blocks";
import { EnquireButton } from "@/components/ui/Enquiry";
import { whatsappLink } from "@/lib/site";

const COUNTRY = {
  dubai: { name: "Dubai & UAE", path: "/dubai-package/", coord: "25°12′ N · 55°16′ E — UNITED ARAB EMIRATES", heroPhoto: "dubai-skyline" },
  thailand: { name: "Thailand", path: "/thailand-package/", coord: "13°45′ N · 100°30′ E — THAILAND", heroPhoto: "bangkok-wat-arun" },
} as const;

export function IntlLandingPage({ country }: { country: "dubai" | "thailand" }) {
  const L = intlLandings[country];
  const C = COUNTRY[country];
  const pkgs = intlPackages.filter((p) => p.country === country);
  const ph = photo(C.heroPhoto);
  // Source quirk: the Thailand landing page's intro carries a copy-pasted paragraph about Dubai.
  const paras = L.aboutParas.map((p) => (country === "thailand" ? p.replace(/\s*Dubai’s allure lies[\s\S]*$/, "") : p)).filter(Boolean);
  const byDuration = [...pkgs].sort((a, b) => (a.days ?? 0) - (b.days ?? 0));
  return (
    <>
      <PageHeader
        crumbs={[{ label: "International", href: "/tours/#international" }, { label: C.name }]}
        coord={C.coord}
        eyebrow={`${pkgs.length} holiday packages from India`}
        title={L.heroHeading ?? C.name}
        lede={L.heroText}
        image={ph?.src ?? L.heroImage}
        imageAlt={ph?.alt ?? C.name}
        imageCredit={ph ? { text: `Photo: ${ph.author} · ${ph.license}`, href: ph.sourceUrl } : null}
      >
        <div className="flex flex-wrap gap-3">
          <a href="#packages" className="btn btn-primary">Explore packages</a>
          <EnquireButton subject={`${C.name} holiday`} className="btn btn-ghost bg-white/70">Enquire</EnquireButton>
        </div>
      </PageHeader>
      <Section>
        <div className="prose-atlas columns-1 gap-12 lg:max-w-none lg:columns-2">{paras.map((p, i) => <p key={i}>{p}</p>)}</div>
        <p className="mt-6 font-mono text-[0.64rem] uppercase tracking-[0.12em] text-muted">Prices are quoted on enquiry for your dates · airfare and visa fees are not included unless stated</p>
      </Section>
      <Section id="packages" tone="mist" eyebrow={`${pkgs.length} itineraries`} title={`${C.name} packages`}>
        <ul className="tile-grid md:grid-cols-2 xl:grid-cols-3">
          {byDuration.map((p) => <PackageCard key={p.slug} p={p} />)}
        </ul>
      </Section>
      {L.faqs.length > 0 && (
        <Section><FaqList faqs={L.faqs} /></Section>
      )}
    </>
  );
}

function PackageCard({ p }: { p: IntlPackage }) {
  return (
    <li className="tile tile-link">
      <Link href={p.path} className="group flex h-full flex-col">
        {p.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.image} alt={p.title} loading="lazy" className="tile-media aspect-[16/9]" />
        ) : (
          <div className="flex aspect-[16/9] w-full items-center justify-center border-b border-line bg-powder/40 font-display text-2xl italic text-navy/60">{p.places.join(" · ")}</div>
        )}
        <div className="tile-body">
          <p className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-stone">{p.duration ?? `${p.days} days`}</p>
          <h3 className="mt-1 font-display text-[1.35rem] text-navy group-hover:underline group-hover:decoration-1 group-hover:underline-offset-4">{p.title}</h3>
          <p className="mt-2 text-sm text-muted">{p.places.join(" · ")}</p>
          <span className="tile-cta text-sm font-semibold text-navy">View itinerary →</span>
        </div>
      </Link>
    </li>
  );
}

export function PackagePage({ p }: { p: IntlPackage }) {
  const C = COUNTRY[p.country];
  const siblings = intlPackages.filter((x) => x.country === p.country && x.slug !== p.slug);
  return (
    <>
      <PageHeader
        crumbs={[{ label: C.name, href: C.path }, { label: p.title }]}
        coord={C.coord}
        eyebrow={`Holiday package · ${p.duration ?? `${p.days} days`}`}
        title={p.title}
        lede={p.metaDescription}
        image={p.image ?? photo(C.heroPhoto)?.src ?? null}
        imageAlt={p.image ? p.title : photo(C.heroPhoto)?.alt ?? C.name}
        imageCredit={!p.image && photo(C.heroPhoto) ? { text: `Photo: ${photo(C.heroPhoto)!.author} · ${photo(C.heroPhoto)!.license}`, href: photo(C.heroPhoto)!.sourceUrl } : null}
      >
        <ul className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
          <li className="flex items-center gap-2"><Clock className="size-4 text-stone" aria-hidden /> {p.duration ?? `${p.days} days`}</li>
          <li className="flex items-center gap-2"><MapPin className="size-4 text-stone" aria-hidden /> {p.places.join(" · ")}</li>
        </ul>
      </PageHeader>
      <div className="container-x grid gap-14 py-16 lg:grid-cols-[1fr_20rem] lg:py-20">
        <div className="min-w-0 space-y-16">
          <section>
            <h2 className="text-display-sm">Overview</h2>
            <div className="mt-6 space-y-8">
              {p.overview.map((o, i) => (
                <div key={i}>
                  {(o.place || o.heading) && <h3 className="font-display text-xl text-navy">{o.place ?? o.heading}</h3>}
                  <p className="prose-atlas mt-2 text-ink/80">{o.text}</p>
                </div>
              ))}
            </div>
          </section>
          <section>
            <h2 className="text-display-sm">Itinerary</h2>
            <ol className="relative mt-8 border-l border-line pl-8">
              {p.itinerary.map((d) => (
                <li key={d.day} className="relative pb-10 last:pb-0">
                  <span className="absolute -left-[2.55rem] top-0 flex size-9 items-center justify-center rounded-full border border-navy bg-white font-mono text-[0.72rem] text-navy">{String(d.day).padStart(2, "0")}</span>
                  <h3 className="font-display text-xl text-navy">{d.title}</h3>
                  <p className="mt-2 max-w-3xl text-ink/80">{d.text}</p>
                </li>
              ))}
            </ol>
            {p.itineraryNote && <p className="mt-6 text-sm text-muted">Note: {p.itineraryNote}</p>}
          </section>
          <section className="grid gap-10 md:grid-cols-2">
            <div>
              <h2 className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-stone">Package includes</h2>
              <div className="mt-4"><CheckList items={p.inclusions} /></div>
            </div>
            <div>
              <h2 className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-stone">Package excludes</h2>
              <div className="mt-4">
                {p.exclusions.length ? <CheckList items={p.exclusions} kind="exclude" /> : <p className="text-sm text-muted">Exclusions are confirmed with your quotation.</p>}
              </div>
            </div>
          </section>
        </div>
        <aside className="border border-line bg-white p-6 lg:sticky lg:top-28 lg:self-start">
          <p className="font-mono text-[0.64rem] uppercase tracking-[0.14em] text-stone">Price</p>
          <p className="mt-2 font-display text-2xl text-navy">On enquiry</p>
          <p className="mt-2 text-sm text-muted">Quoted for your travel dates, hotel category and group size.</p>
          <div className="mt-6 flex flex-col gap-2.5">
            <EnquireButton subject={p.title} className="btn btn-primary w-full">Enquire now</EnquireButton>
            <a href={whatsappLink(`Hello NUAB Tourism, I am interested in the ${p.title} package.`)} target="_blank" rel="noopener noreferrer" className="btn btn-ghost w-full">WhatsApp</a>
          </div>
        </aside>
      </div>
      <Section tone="mist" eyebrow={C.name} title="More packages">
        <LinkRows items={siblings.map((s) => ({ title: s.title, href: s.path, meta: s.duration ?? "", right: "On enquiry" }))} />
        <Link href={C.path} className="mt-8 inline-flex items-center gap-2 font-semibold text-navy link-underline">All {C.name} packages <ArrowRight className="size-4" aria-hidden /></Link>
      </Section>
    </>
  );
}

export function CountryArchive({ country }: { country: "dubai" | "thailand" }) {
  const C = COUNTRY[country];
  const pkgs = intlPackages.filter((p) => p.country === country);
  return (
    <>
      <PageHeader crumbs={[{ label: "Country" }, { label: C.name }]} eyebrow={`${pkgs.length} packages`} title={`${C.name} — all packages`} engraving="himalaya" />
      <Section>
        <LinkRows items={pkgs.map((p) => ({ title: p.title, href: p.path, meta: p.duration ?? "", right: "On enquiry" }))} />
        <Link href={C.path} className="mt-8 inline-flex items-center gap-2 font-semibold text-navy link-underline">{C.name} overview <ArrowRight className="size-4" aria-hidden /></Link>
      </Section>
    </>
  );
}
