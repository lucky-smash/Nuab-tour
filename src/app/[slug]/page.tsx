/**
 * Top-level slugs preserved from the live WordPress site:
 * same-day tours, multi-day packages, outstation-cab pages and blog posts.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { blogPosts, cabPages, dayTours, multiDayTours } from "@/data";
import { DayTourPage, MultiDayPage, CabPageView } from "@/components/tour/TourPages";
import { BlogPostPage } from "@/components/page/BlogPost";

export const dynamicParams = false;

export function generateStaticParams() {
  return [...dayTours, ...multiDayTours, ...cabPages, ...blogPosts].map((x) => ({ slug: x.slug }));
}

function find(slug: string) {
  const day = dayTours.find((t) => t.slug === slug);
  if (day) return { kind: "day" as const, item: day };
  const md = multiDayTours.find((t) => t.slug === slug);
  if (md) return { kind: "multi" as const, item: md };
  const cab = cabPages.find((c) => c.slug === slug);
  if (cab) return { kind: "cab" as const, item: cab };
  const post = blogPosts.find((p) => p.slug === slug);
  if (post) return { kind: "post" as const, item: post };
  return null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const f = find(slug);
  if (!f) return {};
  const title = (f.item.seoTitle ?? f.item.title).replace(/\s*\|\s*(NUAB|Nuab) Tourism\s*$/i, "").replace(/\s*\|\s*Nuab\s*$/i, "");
  return {
    title,
    description: f.item.metaDescription,
    alternates: { canonical: `/${slug}/` },
    openGraph: { title, description: f.item.metaDescription, type: f.kind === "post" ? "article" : "website" },
  };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const f = find(slug);
  if (!f) notFound();
  switch (f.kind) {
    case "day":
      return <DayTourPage t={f.item} />;
    case "multi":
      return <MultiDayPage t={f.item} />;
    case "cab":
      return <CabPageView c={f.item} />;
    case "post":
      return <BlogPostPage post={f.item} />;
  }
}
