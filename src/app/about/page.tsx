import type { Metadata } from "next";
import Link from "next/link";
import { about, home } from "@/data";
import { SITE } from "@/lib/site";
import { PageHeader, Section } from "@/components/page/Blocks";
import { Engraving } from "@/components/engraving/Engraving";

export const metadata: Metadata = {
  title: "About NUAB Tourism — Tour Operator from Delhi",
  description: about.metaDescription,
  alternates: { canonical: "/about/" },
};

export default function AboutPage() {
  return (
    <>
      <PageHeader crumbs={[{ label: "About" }]} eyebrow="About NUAB Tourism" title="Let’s travel together." lede={about.intro} image={about.image} imageAlt="IATA Certificate of Accreditation issued to NUAB Enterprises Private Limited" imageCredit={{ text: "IATA certificate of accreditation, as published by NUAB" }} />
      <Section>
        <div className="grid gap-14 lg:grid-cols-[1fr_1.3fr]">
          <div>
            <p className="font-display text-[1.6rem] leading-snug text-navy">{about.letsTravel}</p>
            <Engraving id="india-gate" className="mt-10 w-64 text-stone/70" />
          </div>
          <div className="prose-atlas">
            {about.paras.map((p, i) => <p key={i}>{p}</p>)}
          </div>
        </div>
      </Section>
      <Section tone="mist">
        <div className="grid gap-px bg-line md:grid-cols-2">
          <article className="bg-white p-8">
            <p className="eyebrow">Our mission</p>
            <p className="mt-4 font-display text-2xl leading-snug text-navy">{about.mission}</p>
          </article>
          <article className="bg-white p-8">
            <p className="eyebrow">Our vision</p>
            <p className="mt-4 font-display text-2xl leading-snug text-navy">{about.vision}</p>
          </article>
        </div>
      </Section>
      <Section eyebrow="Why book with NUAB Tourism" title="How we work">
        <ol className="grid gap-px bg-line md:grid-cols-3">
          {home.whyBook.map((w, i) => (
            <li key={w.title} className="bg-white p-6">
              <span className="font-mono text-[0.7rem] text-stone">0{i + 1}</span>
              <h3 className="mt-3 font-display text-xl">{w.title}</h3>
              <p className="mt-3 text-[0.95rem] text-ink/75">{w.text}</p>
            </li>
          ))}
        </ol>
        <dl className="mt-12 grid gap-6 text-sm sm:grid-cols-3">
          <div><dt className="font-mono text-[0.64rem] uppercase tracking-[0.14em] text-stone">Registered as</dt><dd className="mt-1 font-semibold text-navy">{SITE.legalName}</dd></div>
          <div><dt className="font-mono text-[0.64rem] uppercase tracking-[0.14em] text-stone">Accreditation</dt><dd className="mt-1 font-semibold text-navy">IATA registered (as stated by NUAB)</dd></div>
          <div><dt className="font-mono text-[0.64rem] uppercase tracking-[0.14em] text-stone">Office</dt><dd className="mt-1 font-semibold text-navy">Sushant Lok, Gurugram · {SITE.hours.toLowerCase()}</dd></div>
        </dl>
        <Link href="/contact-us/" className="btn btn-primary mt-12">Contact us</Link>
      </Section>
    </>
  );
}
