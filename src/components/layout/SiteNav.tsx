"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Menu, Phone, X } from "lucide-react";
import { NAV, SITE, clsx } from "@/lib/site";
import { Wordmark } from "./Wordmark";
import { useEnquiry } from "@/components/ui/Enquiry";

/**
 * Editorial navigation: transparent over the home hero, solid white elsewhere / once scrolled.
 * Dropdowns are disclosure buttons (click / Enter / Space / Escape), hover-open on pointer devices.
 */
export function SiteNav() {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [drawer, setDrawer] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const { openEnquiry } = useEnquiry();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setOpen(null);
    setDrawer(false);
  }, [pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setOpen(null); setDrawer(false); }
    };
    const onClick = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpen(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("click", onClick);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("click", onClick); };
  }, []);

  useEffect(() => {
    document.documentElement.style.overflow = drawer ? "hidden" : "";
  }, [drawer]);

  const solid = !isHome || scrolled || drawer;

  return (
    <header
      ref={navRef}
      className={clsx(
        "fixed inset-x-0 top-0 z-50 transition-[background-color,border-color,box-shadow] duration-500",
        // note: backdrop-filter would make the header the containing block of the fixed drawer
        drawer ? "bg-white border-b border-line" : solid ? "bg-white/92 backdrop-blur-md border-b border-line" : "bg-transparent border-b border-transparent",
      )}
    >
      <div className="hidden lg:block border-b border-line/70 bg-white/60">
        <div className="container-x flex h-8 items-center justify-between text-[0.72rem] text-muted">
          <span className="font-mono tracking-wide">IATA REGISTERED · {SITE.legalName.toUpperCase()} · GURUGRAM</span>
          <div className="flex items-center gap-5">
            {SITE.phones.map((p) => (
              <a key={p.tel} href={`tel:${p.tel}`} className="link-underline hover:text-navy">{p.display}</a>
            ))}
            <a href={`mailto:${SITE.email}`} className="link-underline hover:text-navy">{SITE.email}</a>
          </div>
        </div>
      </div>
      <nav aria-label="Primary" className="container-x flex h-16 items-center gap-6">
        <Link href="/" className="shrink-0" aria-label="NUAB Tourism — home">
          <Wordmark />
        </Link>

        <ul className="ml-auto hidden xl:flex items-center gap-1">
          {NAV.map((g) => (
            <NavGroupItem key={g.label} group={g} open={open === g.label} setOpen={(v) => setOpen(v ? g.label : null)} active={!!g.href && pathname.startsWith(g.href.split("#")[0]) && g.href !== "/"} />
          ))}
        </ul>

        <div className="ml-auto xl:ml-2 flex items-center gap-2">
          <a href={`tel:${SITE.phones[0].tel}`} className="hidden sm:inline-flex xl:hidden items-center gap-2 text-sm font-semibold text-navy px-2" aria-label={`Call ${SITE.phones[0].display}`}>
            <Phone className="size-4" aria-hidden /> <span className="hidden md:inline">{SITE.phones[0].display}</span>
          </a>
          <button type="button" onClick={() => openEnquiry()} className="btn btn-primary !min-h-10 !px-4 !text-[0.85rem]">
            Enquire
          </button>
          <button
            type="button"
            className="xl:hidden inline-flex size-10 items-center justify-center text-navy"
            aria-expanded={drawer}
            aria-controls="mobile-drawer"
            aria-label={drawer ? "Close menu" : "Open menu"}
            onClick={() => setDrawer((d) => !d)}
          >
            {drawer ? <X className="size-6" /> : <Menu className="size-6" />}
          </button>
        </div>
      </nav>

      {/* Mobile drawer */}
      <div
        id="mobile-drawer"
        hidden={!drawer}
        className="xl:hidden fixed inset-x-0 bottom-0 top-16 lg:top-24 overflow-y-auto bg-white border-t border-line"
      >
        <div className="container-x py-6">
          <ul className="divide-y divide-line">
            {NAV.map((g) => (
              <li key={g.label} className="py-3">
                {g.items ? (
                  <details className="group">
                    <summary className="flex cursor-pointer list-none items-center justify-between py-1 font-display text-2xl text-navy">
                      {g.label}
                      <ChevronDown className="size-5 text-stone transition-transform group-open:rotate-180" aria-hidden />
                    </summary>
                    <ul className="mt-3 space-y-1 pl-1">
                      {g.href && (
                        <li><Link href={g.href} className="block py-2 text-muted">All {g.label.toLowerCase()}</Link></li>
                      )}
                      {g.items.map((it) => (
                        <li key={it.href}>
                          <Link href={it.href} className="block py-2 text-ink">
                            {it.label}
                            {it.note && <span className="block font-mono text-[0.7rem] tracking-wide text-stone">{it.note}</span>}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : (
                  <Link href={g.href!} className="block py-1 font-display text-2xl text-navy">{g.label}</Link>
                )}
              </li>
            ))}
            <li className="py-3"><Link href="/contact-us/" className="block py-1 font-display text-2xl text-navy">Contact</Link></li>
          </ul>
          <div className="mt-8 space-y-2 text-sm">
            {SITE.phones.map((p) => (
              <a key={p.tel} href={`tel:${p.tel}`} className="flex items-center gap-2 text-navy font-semibold"><Phone className="size-4" aria-hidden />{p.display}</a>
            ))}
            <a href={`mailto:${SITE.email}`} className="block text-muted">{SITE.email}</a>
          </div>
        </div>
      </div>
    </header>
  );
}

function NavGroupItem({ group, open, setOpen, active }: { group: (typeof NAV)[number]; open: boolean; setOpen: (v: boolean) => void; active: boolean }) {
  const id = useId();
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  if (!group.items) {
    return (
      <li>
        <Link href={group.href!} className={clsx("px-3 py-2 text-[0.9rem] font-medium transition-colors hover:text-navy", active ? "text-navy" : "text-ink/80")}>
          {group.label}
        </Link>
      </li>
    );
  }
  return (
    <li
      className="relative"
      onMouseEnter={() => { if (closeTimer.current) clearTimeout(closeTimer.current); setOpen(true); }}
      onMouseLeave={() => { closeTimer.current = setTimeout(() => setOpen(false), 140); }}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className={clsx("inline-flex items-center gap-1 px-3 py-2 text-[0.9rem] font-medium transition-colors hover:text-navy", active || open ? "text-navy" : "text-ink/80")}
      >
        {group.label}
        <ChevronDown className={clsx("size-3.5 text-stone transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      <div
        id={id}
        hidden={!open}
        className="absolute left-1/2 top-full z-10 w-[27rem] -translate-x-1/2 pt-3"
      >
        <div className="border border-line bg-white p-2 shadow-[0_24px_48px_-24px_rgb(35_58_80/0.35)]">
          <ul>
            {group.items.map((it) => (
              <li key={it.href}>
                <Link href={it.href} className="group flex items-baseline justify-between gap-4 px-3 py-2.5 hover:bg-mist">
                  <span className="text-[0.92rem] text-ink group-hover:text-navy">{it.label}</span>
                  {it.note && <span className="shrink-0 font-mono text-[0.66rem] tracking-wide text-stone">{it.note}</span>}
                </Link>
              </li>
            ))}
          </ul>
          {group.href && (
            <Link href={group.href} className="mt-1 flex items-center justify-between border-t border-line px-3 pb-1 pt-3 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-navy">
              View all <span aria-hidden>→</span>
            </Link>
          )}
        </div>
      </div>
    </li>
  );
}
