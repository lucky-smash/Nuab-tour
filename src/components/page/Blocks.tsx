import Link from "next/link";
import { Check, Minus, ChevronRight } from "lucide-react";
import { Engraving } from "@/components/engraving/Engraving";
import { SITE, clsx } from "@/lib/site";
import type { FAQ, ItineraryDay } from "@/data";

export type Crumb = { label: string; href?: string };

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  const all: Crumb[] = [{ label: "Home", href: "/" }, ...items];
  const ld = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: all.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.label, ...(c.href ? { item: SITE.url + c.href } : {}) })),
  };
  return (
    <nav aria-label="Breadcrumb" className="font-mono text-[0.68rem] uppercase tracking-[0.12em] text-muted">
      <ol className="flex flex-wrap items-center gap-1.5">
        {all.map((c, i) => (
          <li key={i} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRight className="size-3 text-stone" aria-hidden />}
            {c.href && i < all.length - 1 ? <Link href={c.href} className="hover:text-navy">{c.label}</Link> : <span aria-current={i === all.length - 1 ? "page" : undefined} className="text-ink/80">{c.label}</span>}
          </li>
        ))}
      </ol>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
    </nav>
  );
}

/** Editorial page header used by every inner page. */
export function PageHeader({
  crumbs,
  eyebrow,
  title,
  lede,
  coord,
  engraving,
  image,
  imageAlt,
  imageCredit,
  children,
  tone = "mist",
}: {
  crumbs: Crumb[];
  eyebrow?: string;
  title: string;
  lede?: string;
  coord?: string;
  engraving?: string;
  image?: string | null;
  imageAlt?: string;
  imageCredit?: { text: string; href?: string | null } | null;
  children?: React.ReactNode;
  tone?: "mist" | "white" | "powder";
}) {
  return (
    <header className={clsx("relative overflow-hidden pt-32 pb-14 md:pt-40 md:pb-20", tone === "mist" ? "bg-mist" : tone === "powder" ? "bg-powder/60" : "bg-white")}>
      {engraving && !image && (
        // the monument as a background plate: the right half of the header (below the fixed nav), drawn whole
        // and in proportion (fitted to that box, centred, base flush on the bottom edge), fading out toward
        // the text and very slightly at the foot. Only this layer is faded; the text sits above it.
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-0 right-0 top-[45%] w-[78%] sm:top-1/3 sm:w-[62%] md:top-24 md:w-1/2 lg:top-28"
          style={{
            maskImage: "linear-gradient(to right, transparent 0%, #000 42%), linear-gradient(to top, rgb(0 0 0 / .6) 0%, #000 14%)",
            maskComposite: "intersect",
            WebkitMaskImage: "linear-gradient(to right, transparent 0%, #000 42%), linear-gradient(to top, rgb(0 0 0 / .6) 0%, #000 14%)",
            WebkitMaskComposite: "source-in",
          }}
        >
          <Engraving id={engraving} ground preserveAspectRatio="xMidYMax meet" className="h-full w-full text-navy/[.09] md:text-navy/[.16]" weight={1.4} />
        </div>
      )}
      <div className={clsx("container-x relative", image && "grid gap-10 lg:grid-cols-[1.15fr_1fr] lg:items-end")}>
        <div>
          <Breadcrumbs items={crumbs} />
          {coord && <p className="coord mt-8">{coord}</p>}
          {eyebrow && <p className={clsx("eyebrow", coord ? "mt-3" : "mt-8")}>{eyebrow}</p>}
          <h1 className="mt-3 text-display-lg text-balance">{title}</h1>
          {lede && <p className="mt-5 max-w-2xl text-lede text-ink/75">{lede}</p>}
          {children && <div className="mt-8">{children}</div>}
        </div>
        {image && (
          <figure className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image} alt={imageAlt ?? ""} className="aspect-[4/3] w-full object-cover" />
            {imageCredit && (
              <figcaption className="mt-2 font-mono text-[0.6rem] uppercase tracking-[0.1em] text-muted">
                {imageCredit.href ? <a href={imageCredit.href} target="_blank" rel="noopener noreferrer" className="hover:text-navy">{imageCredit.text}</a> : imageCredit.text}
              </figcaption>
            )}
          </figure>
        )}
      </div>
    </header>
  );
}

export function Section({ id, eyebrow, title, children, className, tone = "white", aside }: { id?: string; eyebrow?: string; title?: string; children: React.ReactNode; className?: string; tone?: "white" | "mist"; aside?: React.ReactNode }) {
  return (
    <section id={id} className={clsx("scroll-mt-28 py-16 md:py-20", tone === "mist" ? "bg-mist" : "bg-white", className)}>
      <div className="container-x">
        {(eyebrow || title) && (
          <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
            <div>
              {eyebrow && <p className="eyebrow">{eyebrow}</p>}
              {title && <h2 className="mt-2 text-display-md text-balance">{title}</h2>}
            </div>
            {aside}
          </div>
        )}
        {children}
      </div>
    </section>
  );
}

export function FaqList({ faqs, title = "Frequently asked questions" }: { faqs: FAQ[]; title?: string }) {
  if (!faqs.length) return null;
  const ld = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) };
  return (
    <div>
      <h2 className="text-display-sm">{title}</h2>
      <div className="mt-6 divide-y divide-line border-y border-line">
        {faqs.map((f) => (
          <details key={f.q} className="group">
            <summary className="flex cursor-pointer list-none items-start justify-between gap-6 py-5 text-[1.02rem] font-semibold text-navy">
              <span>{f.q.replace(/^\s*[a-z]/, (c) => c.toUpperCase())}</span>
              <span aria-hidden className="mt-1 font-mono text-stone transition-transform group-open:rotate-45">+</span>
            </summary>
            <p className="max-w-3xl pb-6 text-ink/80">{f.a.replace(/^\s*[a-z]/, (c) => c.toUpperCase())}</p>
          </details>
        ))}
      </div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
    </div>
  );
}

export function CheckList({ items, kind = "include" }: { items: string[]; kind?: "include" | "exclude" }) {
  return (
    <ul className="space-y-2.5">
      {items.map((it) => (
        <li key={it} className="flex gap-3 text-[0.95rem]">
          {kind === "include" ? <Check className="mt-1 size-4 shrink-0 text-navy" aria-hidden /> : <Minus className="mt-1 size-4 shrink-0 text-stone" aria-hidden />}
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}

export function Itinerary({ days }: { days: ItineraryDay[] }) {
  return (
    <ol className="relative border-l border-line pl-8">
      {days.map((d) => (
        <li key={d.day} className="relative pb-12 last:pb-0">
          <span className="absolute -left-[2.55rem] top-0 flex size-9 items-center justify-center rounded-full border border-navy bg-white font-mono text-[0.72rem] text-navy">{String(d.day).padStart(2, "0")}</span>
          <p className="font-mono text-[0.66rem] uppercase tracking-[0.14em] text-stone">Day {d.day}</p>
          <h3 className="mt-1 font-display text-2xl text-navy">{d.title}</h3>
          {d.paras.map((p, i) => (
            <p key={i} className="mt-3 max-w-3xl whitespace-pre-line text-ink/80">{p}</p>
          ))}
          {d.items.length > 0 && <ul className="mt-3 list-disc space-y-1 pl-5 text-ink/80 marker:text-stone">{d.items.map((x) => <li key={x}>{x}</li>)}</ul>}
          {d.stops.map((s) => (
            <div key={s.title} className="mt-5">
              <h4 className="text-[0.95rem] font-semibold text-navy">{s.title}</h4>
              {s.text && <p className="mt-1.5 max-w-3xl text-ink/80">{s.text}</p>}
              {s.items.length > 0 && (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-[0.95rem] text-ink/80 marker:text-stone">
                  {s.items.map((x) => {
                    const [k, ...rest] = x.split(":");
                    return <li key={x}>{rest.length ? <><strong className="font-semibold text-ink">{k}:</strong>{rest.join(":")}</> : x}</li>;
                  })}
                </ul>
              )}
            </div>
          ))}
        </li>
      ))}
    </ol>
  );
}

export function DataTable({ head, rows, caption }: { head: string[]; rows: (string | React.ReactNode)[][]; caption?: string }) {
  return (
    <div className="table-scroll">
      <table className="w-full min-w-[32rem] border-collapse text-left text-[0.95rem]">
        {caption && <caption className="mb-3 text-left font-mono text-[0.66rem] uppercase tracking-[0.12em] text-muted">{caption}</caption>}
        <thead>
          <tr className="border-b border-navy">
            {head.map((h) => <th key={h} scope="col" className="py-3 pr-4 font-mono text-[0.68rem] font-normal uppercase tracking-[0.12em] text-muted">{h}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => <td key={j} className={clsx("py-3.5 pr-4 align-top", j === 0 && "font-semibold text-navy")}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Cross-link card list (editorial rows). */
export function LinkRows({ items }: { items: { title: string; href: string; meta?: string; right?: string; rightSub?: string }[] }) {
  return (
    <ul className="divide-y divide-line border-y border-line">
      {items.map((it) => (
        <li key={it.href}>
          <Link href={it.href} className="group flex items-baseline justify-between gap-4 py-4">
            <span className="min-w-0">
              <span className="block font-display text-[1.2rem] leading-snug text-navy group-hover:underline group-hover:decoration-1 group-hover:underline-offset-4">{it.title}</span>
              {it.meta && <span className="mt-0.5 block font-mono text-[0.64rem] uppercase tracking-[0.1em] text-muted">{it.meta}</span>}
            </span>
            {it.right && (
              <span className="shrink-0 text-right">
                <span className="block text-[0.95rem] font-semibold">{it.right}</span>
                {it.rightSub && <span className="block text-[0.7rem] text-muted">{it.rightSub}</span>}
              </span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}
