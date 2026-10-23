import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PackagePage } from "@/components/intl/IntlPages";
import { intlPackages } from "@/data";

export const dynamicParams = false;
export function generateStaticParams() {
  return intlPackages.map((p) => ({ slug: p.slug }));
}
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = intlPackages.find((x) => x.slug === slug);
  if (!p) return {};
  return { title: (p.seoTitle ?? p.title).replace(/\s*\|\s*Nuab( Tourism)?\s*$/i, ""), description: p.metaDescription, alternates: { canonical: `/packages/${p.slug}/` } };
}
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = intlPackages.find((x) => x.slug === slug);
  if (!p) notFound();
  return <PackagePage p={p} />;
}
