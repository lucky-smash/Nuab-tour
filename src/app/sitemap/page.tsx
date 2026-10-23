import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, Section } from "@/components/page/Blocks";
import { routeGroups } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Sitemap — All Tour Packages & Pages",
  description: "Every NUAB Tourism tour package, day trip, destination and page in one organised list.",
  alternates: { canonical: "/sitemap/" },
};

export default function SitemapPage() {
  const groups = routeGroups();
  const total = groups.reduce((a, g) => a + g.items.length, 0);
  return (
    <>
      <PageHeader crumbs={[{ label: "Sitemap" }]} eyebrow={`${total} pages`} title="Sitemap" tone="white" />
      <Section>
        <div className="columns-1 gap-12 md:columns-2 xl:columns-3">
          {groups.map((g) => (
            <div key={g.title} className="mb-12 break-inside-avoid">
              <h2 className="border-b border-navy pb-2 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-navy">{g.title} <span className="text-muted">({g.items.length})</span></h2>
              <ul className="mt-3 space-y-1.5 text-[0.92rem]">
                {g.items.map((it) => <li key={it.path}><Link href={it.path} className="hover:text-navy hover:underline">{it.label}</Link></li>)}
              </ul>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}
