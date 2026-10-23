import Link from "next/link";
import { blogPosts, type BlogPost } from "@/data";
import { PageHeader, LinkRows, Section } from "@/components/page/Blocks";
import { EnquireButton } from "@/components/ui/Enquiry";
import { SITE } from "@/lib/site";

const ENGRAVING_FOR = (title: string) => (/agra/i.test(title) ? "taj-mahal" : /jaipur/i.test(title) ? "hawa-mahal" : /mathura|vrindavan/i.test(title) ? "temple" : /uttarakhand/i.test(title) ? "himalaya" : "india-gate");

export function BlogPostPage({ post }: { post: BlogPost }) {
  const others = blogPosts.filter((p) => p.slug !== post.slug);
  const date = post.published ? new Date(post.published + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : null;
  const ld = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    datePublished: post.published,
    description: post.metaDescription,
    publisher: { "@type": "Organization", name: SITE.name },
    mainEntityOfPage: SITE.url + post.path,
  };
  return (
    <article>
      <PageHeader crumbs={[{ label: "Blogs", href: "/blogs/" }, { label: post.title }]} eyebrow={[date, `${post.readingMinutes} min read`].filter(Boolean).join(" · ")} title={post.title} lede={post.metaDescription} engraving={ENGRAVING_FOR(post.title)} />
      <div className="container-x grid gap-14 py-16 lg:grid-cols-[1fr_18rem]">
        <div className="prose-atlas" dangerouslySetInnerHTML={{ __html: post.html.replaceAll(`href="https://nuabtourism.in/`, `href="/`) }} />
        <aside className="space-y-6 lg:sticky lg:top-28 lg:self-start">
          <div className="border border-line p-5">
            <p className="font-mono text-[0.64rem] uppercase tracking-[0.14em] text-stone">Plan this trip</p>
            <p className="mt-2 text-sm text-ink/80">Talk to a NUAB travel consultant about dates, vehicles and prices.</p>
            <EnquireButton subject={post.title} className="btn btn-primary mt-4 w-full">Enquire</EnquireButton>
          </div>
          <Link href="/tours/" className="block text-sm font-semibold text-navy link-underline">Browse all tours & fares →</Link>
        </aside>
      </div>
      <Section tone="mist" eyebrow="Journal" title="More from the blog">
        <LinkRows items={others.map((p) => ({ title: p.title, href: p.path, meta: `${p.published ?? ""} · ${p.readingMinutes} min read` }))} />
      </Section>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
    </article>
  );
}
