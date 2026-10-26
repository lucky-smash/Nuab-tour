import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";
import { SITE, formatCoord } from "@/lib/site";
import { carTours, multiDayTours } from "@/data";
import { Wordmark } from "./Wordmark";

const FOOTER_MD_LABELS: Record<string, string> = {
  "1-night-2-days-mathura-vrindavan": "2 Days Mathura Vrindavan",
  "2-night-3-days-agra-mathura": "Mathura Vrindavan Agra",
  "3-days-mathura-vrindavan-tour": "Gokul Mathura Vrindavan",
  "2-night-3-days-mathura-pilgrimage": "2 Nights 3 Days Mathura Vrindavan Pilgrimage",
  "3-days-mathura-govardhan-agra": "Agra Mathura Vrindavan Gokul Govardhan Nandgaon Barsana",
  "6-days-mathura-agra-haridwar-tour": "Delhi Agra Mathura Vrindavan Haridwar",
  "6-days-delhi-jaipur-agra-mathura": "Delhi Agra Jaipur 6 Days",
};

export function Footer() {
  return (
    <footer className="bg-navy text-white/80">
      <div className="container-x pt-16 pb-10">
        <div className="grid gap-12 lg:grid-cols-[1.3fr_1fr_1fr_1fr]">
          <div>
            <Wordmark inverted className="h-16" />
            <p className="mt-6 max-w-sm text-[0.95rem] leading-relaxed text-white/70">{SITE.footerTagline}</p>
            <p className="mt-6 font-display text-xl italic text-white/90">“{SITE.tagline}”</p>
          </div>

          <FooterCol title="Golden Triangle Tours Packages">
            {multiDayTours.map((t) => (
              <FooterLink key={t.slug} href={t.path}>{FOOTER_MD_LABELS[t.slug] ?? t.title}</FooterLink>
            ))}
          </FooterCol>

          <FooterCol title="Car Tours (One Day)">
            {carTours.map((t) => (
              <FooterLink key={t.slug} href={t.path}>{t.title}</FooterLink>
            ))}
            <li className="pt-3"><span className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-white/45">Quick links</span></li>
            <FooterLink href="/about/">About Us</FooterLink>
            <FooterLink href="/contact-us/">Contact Us</FooterLink>
            <FooterLink href="/blogs/">Blogs</FooterLink>
            <FooterLink href="/sitemap/">Sitemap</FooterLink>
          </FooterCol>

          <div>
            <h2 className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-white/50">India Office</h2>
            <address className="mt-5 space-y-4 not-italic text-[0.95rem]">
              <a href={SITE.mapsUrl} target="_blank" rel="noopener noreferrer" className="flex gap-3 hover:text-white">
                <MapPin className="mt-1 size-4 shrink-0 text-white/50" aria-hidden />
                <span>{SITE.address.line1},<br />{SITE.address.line2},<br />{SITE.address.city}</span>
              </a>
              {SITE.phones.map((p) => (
                <a key={p.tel} href={`tel:${p.tel}`} className="flex items-center gap-3 hover:text-white">
                  <Phone className="size-4 text-white/50" aria-hidden /> {p.display}
                </a>
              ))}
              <a href={`mailto:${SITE.email}`} className="flex items-center gap-3 break-all hover:text-white">
                <Mail className="size-4 shrink-0 text-white/50" aria-hidden /> {SITE.email}
              </a>
            </address>
            <p className="mt-6 font-mono text-[0.7rem] tracking-wide text-white/45">
              {formatCoord(SITE.address.lat, "lat")} · {formatCoord(SITE.address.lng, "lng")} — GURUGRAM
            </p>
          </div>
        </div>

        <p aria-hidden className="pointer-events-none mt-16 select-none overflow-hidden whitespace-nowrap font-display text-[clamp(2.4rem,8.4vw,8.6rem)] leading-[0.85] tracking-[-0.03em] text-transparent [-webkit-text-stroke:1px_rgb(198_167_123/.45)]">
          India, seen differently.
        </p>
        <div className="mt-10 flex flex-col gap-3 border-t border-white/15 pt-6 text-[0.8rem] text-white/50 md:flex-row md:items-center md:justify-between">
          <p>© {new Date().getFullYear()} {SITE.legalName}. All rights reserved. IATA registered.</p>
          <div className="flex gap-5">
            <Link href="/privacy-policy/" className="hover:text-white">Privacy Policy</Link>
            <Link href="/sitemap/" className="hover:text-white">Sitemap</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-white/50">{title}</h2>
      <ul className="mt-5 space-y-2.5 text-[0.92rem]">{children}</ul>
    </div>
  );
}
function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link href={href} className="text-white/75 transition-colors hover:text-white">{children}</Link>
    </li>
  );
}
