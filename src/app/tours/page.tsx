import type { Metadata } from "next";
import Link from "next/link";
import { busTours, cabPages, carTours, intlPackages, multiDayTours } from "@/data";
import { formatINR } from "@/lib/site";
import { DataTable, LinkRows, PageHeader, Section } from "@/components/page/Blocks";

export const metadata: Metadata = {
  title: "Tours & Fares from Delhi",
  description: "Every NUAB Tourism tour with published fares: same-day car and coach tours from Delhi, Golden Triangle and pilgrimage packages, outstation cabs, Dubai and Thailand holidays.",
  alternates: { canonical: "/tours/" },
};

export default function ToursPage() {
  return (
    <>
      <PageHeader
        crumbs={[{ label: "Tours" }]}
        eyebrow="Tours & fares"
        title="Every journey, with its published price."
        lede="Same-day tours are quoted per vehicle (car) or per seat (coach). Multi-day packages are quoted per person or per vehicle, as listed. International holidays are planned to your dates and quoted on enquiry."
        engraving="taj-mahal"
      />
      <Section eyebrow="Same-day · private AC car" title="Day tours by car">
        <DataTable
          head={["Tour", "Duration", "Swift Dzire", "Ertiga", "Innova Crysta"]}
          caption="Fare per vehicle · fuel, tolls, parking, driver allowance and GST included"
          rows={carTours.map((t) => [
            <Link key="t" href={t.path} className="hover:underline underline-offset-4">{t.title}</Link>,
            t.durationText,
            ...[0, 1, 2].map((i) => (t.fares[i] ? formatINR(t.fares[i].fare) : "—")),
          ])}
        />
      </Section>
      <Section id="bus" tone="mist" eyebrow="Same-day · seat in coach" title="Day tours by coach">
        <LinkRows items={busTours.map((t) => ({ title: t.title, href: t.path, meta: t.fares.length ? t.fares.map((f) => `${f.departure} dep.`).join(" · ") : "Seat in coach", right: t.fromPrice ? `from ${formatINR(t.fromPrice)}` : undefined, rightSub: "per seat" }))} />
      </Section>
      <Section id="multi-day" eyebrow="Golden Triangle & pilgrimage" title="Multi-day packages">
        <LinkRows items={multiDayTours.map((t) => ({ title: t.title, href: t.path, meta: t.durationText, right: t.fromPrice ? `from ${formatINR(t.fromPrice)}` : "On enquiry", rightSub: t.pricing?.basis }))} />
      </Section>
      <Section id="cabs" tone="mist" eyebrow="Outstation cabs · from ₹10/km · 24×7" title="Cabs from Delhi">
        <LinkRows items={cabPages.map((c) => ({ title: c.title, href: c.path, meta: c.routes.map((r) => r.to).slice(0, 6).join(" · "), right: "₹10/km", rightSub: `${c.routes.length} routes` }))} />
      </Section>
      <Section id="international" eyebrow="Beyond India" title="Holiday packages">
        <div className="grid gap-12 md:grid-cols-2">
          {(["dubai", "thailand"] as const).map((c) => (
            <div key={c}>
              <h3 className="mb-4 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-stone">{c === "dubai" ? "Dubai & UAE" : "Thailand"}</h3>
              <LinkRows items={intlPackages.filter((p) => p.country === c).map((p) => ({ title: p.title, href: p.path, meta: p.duration ?? "", right: "On enquiry" }))} />
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}
