import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CountryArchive } from "@/components/intl/IntlPages";

export const dynamicParams = false;
export function generateStaticParams() {
  return [{ country: "dubai" }, { country: "thailand" }];
}
export async function generateMetadata({ params }: { params: Promise<{ country: string }> }): Promise<Metadata> {
  const { country } = await params;
  const name = country === "dubai" ? "Dubai" : "Thailand";
  return { title: `${name} Packages`, alternates: { canonical: `/country/${country}/` } };
}
export default async function Page({ params }: { params: Promise<{ country: string }> }) {
  const { country } = await params;
  if (country !== "dubai" && country !== "thailand") notFound();
  return <CountryArchive country={country} />;
}
