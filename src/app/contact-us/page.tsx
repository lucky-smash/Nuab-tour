import type { Metadata } from "next";
import { Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { contact } from "@/data";
import { SITE, formatCoord, whatsappLink } from "@/lib/site";
import { PageHeader, Section } from "@/components/page/Blocks";
import { EnquireButton } from "@/components/ui/Enquiry";

export const metadata: Metadata = {
  title: "Contact NUAB Tourism — Book a Tour from Delhi",
  description: contact.metaDescription,
  alternates: { canonical: "/contact-us/" },
};

export default function ContactPage() {
  return (
    <>
      <PageHeader crumbs={[{ label: "Contact Us" }]} coord={`${formatCoord(SITE.address.lat, "lat")} · ${formatCoord(SITE.address.lng, "lng")} — GURUGRAM / HARYANA`} eyebrow="Speak to a travel consultant" title="Get in touch." lede={contact.intro} engraving="india-gate">
        <EnquireButton className="btn btn-primary" subject="General enquiry">Send an enquiry</EnquireButton>
      </PageHeader>
      <Section>
        <p className="max-w-2xl text-lede text-ink/75">{contact.getInTouch}</p>
        <div className="mt-12 grid gap-px bg-line md:grid-cols-2 lg:grid-cols-4">
          <div className="bg-white p-6">
            <MapPin className="size-5 text-navy" aria-hidden />
            <h2 className="mt-4 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-stone">Office address</h2>
            <address className="mt-2 not-italic text-[0.95rem]">{SITE.address.line1},<br />{SITE.address.line2},<br />{SITE.address.city}</address>
            <a href={SITE.mapsUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block text-sm font-semibold text-navy link-underline">Open in Google Maps</a>
          </div>
          <div className="bg-white p-6">
            <Phone className="size-5 text-navy" aria-hidden />
            <h2 className="mt-4 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-stone">Phone / WhatsApp</h2>
            <ul className="mt-2 space-y-1">
              {SITE.phones.map((p) => <li key={p.tel}><a className="font-semibold text-navy hover:underline" href={`tel:${p.tel}`}>{p.display}</a></li>)}
            </ul>
          </div>
          <div className="bg-white p-6">
            <Mail className="size-5 text-navy" aria-hidden />
            <h2 className="mt-4 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-stone">Email</h2>
            <a className="mt-2 block break-all font-semibold text-navy hover:underline" href={`mailto:${SITE.email}`}>{SITE.email}</a>
          </div>
          <div className="bg-white p-6">
            <MessageCircle className="size-5 text-navy" aria-hidden />
            <h2 className="mt-4 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-stone">WhatsApp</h2>
            <a className="mt-2 block font-semibold text-navy hover:underline" href={whatsappLink("Hello NUAB Tourism, I have a question about a tour.")} target="_blank" rel="noopener noreferrer">Message us on WhatsApp</a>
            <p className="mt-2 text-sm text-muted">{SITE.hours}.</p>
          </div>
        </div>
      </Section>
      <Section tone="mist" eyebrow="Find us" title="Sushant Lok, Gurugram">
        <div className="aspect-[16/7] w-full overflow-hidden border border-line bg-white">
          <iframe
            title="NUAB Tourism office on Google Maps"
            src={`https://maps.google.com/maps?q=${encodeURIComponent(SITE.address.full)}&t=m&z=14&output=embed`}
            className="h-full w-full grayscale-[.35]"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </Section>
    </>
  );
}
