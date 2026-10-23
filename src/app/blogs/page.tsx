import type { Metadata } from "next";
import Link from "next/link";
import { blog, blogPosts } from "@/data";
import { PageHeader, Section } from "@/components/page/Blocks";

export const metadata: Metadata = {
  title: "Travel Blog — Tips, Itineraries & Guides",
  description: blog.listing.metaDescription,
  alternates: { canonical: "/blogs/" },
};

export default function BlogsPage() {
  const [lead, ...rest] = blogPosts;
  return (
    <>
      <PageHeader crumbs={[{ label: "Blogs" }]} eyebrow="Journal" title="Notes from the road." lede="Itineraries, guides and practical advice from the NUAB Tourism team." engraving="jhula" />
      <Section>
        <Link href={lead.path} className="group grid gap-8 border-b border-line pb-14 lg:grid-cols-[1.2fr_1fr] lg:items-center">
          {lead.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={lead.image} alt={lead.title} className="aspect-[3/2] w-full object-cover" />
          )}
          <div>
            <p className="font-mono text-[0.66rem] uppercase tracking-[0.12em] text-stone">{lead.published} · {lead.readingMinutes} min read</p>
            <h2 className="mt-3 text-display-md group-hover:underline group-hover:decoration-1 group-hover:underline-offset-8">{lead.title}</h2>
            <p className="mt-4 text-ink/75">{lead.metaDescription}</p>
          </div>
        </Link>
        <ul className="mt-14 grid gap-12 md:grid-cols-2">
          {rest.map((p) => (
            <li key={p.slug}>
              <Link href={p.path} className="group block">
                {p.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.image} alt={p.title} loading="lazy" className="aspect-[3/2] w-full object-cover" />
                )}
                <p className="mt-4 font-mono text-[0.66rem] uppercase tracking-[0.12em] text-stone">{p.published} · {p.readingMinutes} min read</p>
                <h2 className="mt-2 font-display text-2xl text-navy group-hover:underline group-hover:decoration-1 group-hover:underline-offset-4">{p.title}</h2>
                <p className="mt-2 text-[0.95rem] text-ink/75">{p.metaDescription}</p>
              </Link>
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}
