"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowDown, ArrowRight, ArrowUpRight } from "lucide-react";
import { Engraving } from "@/components/engraving/Engraving";
import { clsx } from "@/lib/site";
import { journey } from "./journeyMath";
import { HERO_END, ARRIVAL_P } from "./config";
import type { StopVM, TourVM, PhotoVM } from "./viewModel";
import { useEnquiry } from "@/components/ui/Enquiry";

const JourneyCanvas = dynamic(() => import("./JourneyCanvas"), { ssr: false });

const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

type Mode = "pending" | "static" | "immersive";

function supportsWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

export function Journey({ stops, destinationCount, heroCoord }: { stops: StopVM[]; destinationCount: number; heroCoord: string }) {
  // Server render = the immersive shell (CSS sky + hero copy, visible at first paint, no flash).
  // The client then enables the 3D stage, or swaps to the complete static journey for reduced
  // motion, no WebGL, or ?no3d=1.
  const [mode, setMode] = useState<Mode>("pending");
  const [lite, setLite] = useState(false);
  const [staticReason, setStaticReason] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const webgl = supportsWebGL();
    if (params.has("no3d")) { setStaticReason("3D disabled"); setMode("static"); }
    else if (reduced) { setStaticReason("Reduced motion is on — showing the still journey."); setMode("static"); }
    else if (!webgl) { setStaticReason("Your browser could not start 3D — showing the still journey."); setMode("static"); }
    else {
      const nav = navigator as Navigator & { deviceMemory?: number };
      setLite(window.innerWidth < 820 || (nav.hardwareConcurrency ?? 8) <= 4 || (nav.deviceMemory ?? 8) <= 4);
      setMode("immersive");
    }
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => { if (mq.matches) setMode("static"); };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return mode === "static" ? (
    <StaticJourney stops={stops} heroCoord={heroCoord} note={staticReason} />
  ) : (
    <ImmersiveJourney stops={stops} lite={lite} enable3d={mode === "immersive"} destinationCount={destinationCount} heroCoord={heroCoord} />
  );
}

// ===========================================================================
// Immersive
// ===========================================================================
function ImmersiveJourney({ stops, lite, enable3d, destinationCount, heroCoord }: { stops: StopVM[]; lite: boolean; enable3d: boolean; destinationCount: number; heroCoord: string }) {
  const section = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const fill = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(true);
  const [ready, setReady] = useState(false);
  const [current, setCurrent] = useState<string>("hero");

  // Only render frames while the stage is on screen.
  useEffect(() => {
    const el = section.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { setActive(e.isIntersecting); journey.visible = e.isIntersecting; }, { rootMargin: "100px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useIsoLayoutEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    let live = 0; // last progress measured with a settled layout
    const ctx = gsap.context(() => {
      const st = ScrollTrigger.create({
        trigger: section.current,
        start: "top top",
        end: "bottom bottom",
        onUpdate: (self) => {
          journey.target = self.progress;
          live = self.progress;
          if (fill.current) fill.current.style.transform = `scaleY(${self.progress})`;
          let id = "hero";
          if (self.progress > HERO_END) id = "transit";
          for (const s of stops) if (Math.abs(self.progress - s.p) < 0.07) id = s.id;
          if (self.progress > ARRIVAL_P - 0.015) id = "arrival";
          setCurrent((c) => (c === id ? c : id));
        },
      });
      journey.target = st.progress;

      const tl = gsap.timeline({ defaults: { ease: "power2.out" }, scrollTrigger: { trigger: section.current, start: "top top", end: "bottom bottom", scrub: 0.9 } });
      tl.set({}, {}, 1); // timeline length = 1 ⇒ positions are journey progress
      tl.to("[data-panel='hero']", { autoAlpha: 0, y: -50, duration: 0.03, ease: "power1.in" }, HERO_END - 0.015);
      tl.to("[data-hero-scroll]", { autoAlpha: 0, duration: 0.01 }, 0.004);
      for (const s of stops) {
        const sel = `[data-panel='${s.id}']`;
        const enter = Math.max(s.p - 0.065, HERO_END + 0.03); // never overlaps the hero fade
        tl.fromTo(sel, { autoAlpha: 0, y: 46 }, { autoAlpha: 1, y: 0, duration: 0.03 }, enter);
        if (s.photo && !s.hasModel) tl.fromTo(`${sel} [data-postcard]`, { autoAlpha: 0, y: 60, rotate: s.layout === "left" ? 3 : -3 }, { autoAlpha: 1, y: 0, rotate: s.layout === "left" ? 1.5 : -1.5, duration: 0.035 }, enter + 0.01);
        tl.to(sel, { autoAlpha: 0, y: -46, duration: 0.03, ease: "power1.in" }, s.p + 0.055);
      }
      tl.fromTo("[data-panel='arrival']", { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: 0.03 }, ARRIVAL_P - 0.01);
    }, section);

    // Keep the visitor at the same point of the journey when the viewport resizes (the section is
    // sized in viewport units, so its pixel height changes while the scroll offset would not).
    let saved: number | null = null;
    const onRefreshInit = () => {
      // the layout may already reflect the new viewport here, so use the last tracked progress
      saved = live > 0 && live < 1 ? live : null;
    };
    const onRefresh = () => {
      const el = section.current;
      if (!el || saved == null) return;
      const top = el.getBoundingClientRect().top + window.scrollY;
      const p = saved;
      saved = null;
      window.scrollTo({ top: top + (el.offsetHeight - window.innerHeight) * p, behavior: "auto" });
      // a scroll made inside ScrollTrigger's refresh is not always reported back: sync explicitly
      journey.target = p;
      live = p;
      requestAnimationFrame(() => ScrollTrigger.update());
    };
    ScrollTrigger.addEventListener("refreshInit", onRefreshInit);
    ScrollTrigger.addEventListener("refresh", onRefresh);
    const onResize = () => ScrollTrigger.refresh();
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("orientationchange", onResize);
      ScrollTrigger.removeEventListener("refreshInit", onRefreshInit);
      ScrollTrigger.removeEventListener("refresh", onRefresh);
      ctx.revert();
    };
  }, [stops]);

  const goTo = useCallback((p: number) => {
    const el = section.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY;
    const span = el.offsetHeight - window.innerHeight;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: top + span * p, behavior: reduced ? "auto" : "smooth" });
  }, []);

  useEffect(() => {
    const w = window as unknown as { __nuabJourneyGoTo?: (p: number) => void };
    w.__nuabJourneyGoTo = (p: number) => {
      const el = section.current!;
      const top = el.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: top + (el.offsetHeight - window.innerHeight) * p, behavior: "auto" });
    };
    return () => { delete w.__nuabJourneyGoTo; };
  }, []);

  return (
    <section ref={section} id="journey" aria-label="The NUAB journey: Delhi, Agra, Jaipur, Mathura–Vrindavan, Haridwar–Rishikesh" className="relative h-[840vh] md:h-[1020vh]">
      <div ref={stage} className="sky-hero sticky top-0 h-[100svh] w-full overflow-hidden">
        <div className={clsx("absolute inset-0 transition-opacity duration-[900ms]", ready ? "opacity-100" : "opacity-0")}>
          {enable3d && <JourneyCanvas active={active} lite={lite} onAircraftReady={() => setReady(true)} />}
        </div>
        {enable3d && !ready && <StageLoading />}

        {/* top scrim keeps the navigation legible over the sky */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-[rgb(246_242_234/.75)] to-transparent" />

        <HeroPanel coord={heroCoord} />
        {stops.map((s) => (
          <StopPanel key={s.id} stop={s} current={current === s.id} index={stops.indexOf(s) + 1} />
        ))}
        <ArrivalPanel destinationCount={destinationCount} current={current === "arrival"} />

        <ProgressRail stops={stops} fill={fill} current={current} onGo={goTo} />
        <div data-hero-scroll className="pointer-events-none absolute bottom-7 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-3 text-navy md:flex">
          <span className="font-mono text-[0.68rem] uppercase tracking-[0.24em]">Scroll to begin the journey</span>
          <span className="relative block h-12 w-px overflow-hidden bg-navy/20">
            <span className="absolute inset-x-0 top-0 h-1/2 animate-[scrollcue_1.8s_ease-in-out_infinite] bg-navy" />
          </span>
        </div>
      </div>
      <style>{`@keyframes scrollcue{0%{transform:translateY(-100%)}100%{transform:translateY(200%)}}`}</style>
    </section>
  );
}

function StageLoading() {
  return (
    <div className="pointer-events-none absolute bottom-24 right-[8%] hidden items-center gap-3 md:flex" aria-hidden>
      <span className="relative block h-px w-14 overflow-hidden bg-navy/20">
        <span className="absolute inset-y-0 left-0 w-1/3 animate-[scrollcue_1.4s_ease-in-out_infinite] bg-navy/70" />
      </span>
      <span className="font-mono text-[0.66rem] uppercase tracking-[0.22em] text-navy/70">Aircraft arriving</span>
    </div>
  );
}

const SERVICES: { label: string; href: string }[] = [
  { label: "Same-day tours", href: "/tours/" },
  { label: "Golden Triangle", href: "/tours/#multi-day" },
  { label: "Outstation cabs", href: "/tours/#cabs" },
  { label: "Dubai & Thailand", href: "/tours/#international" },
];

/** Hero copy shared by the immersive and the static hero: what NUAB sells, in one glance. */
function HeroCopy({ coord, animate }: { coord: string; animate: boolean }) {
  const rise = (d: number) => (animate ? { className: "hero-rise", style: { "--d": `${d}s` } as React.CSSProperties } : { className: "", style: undefined });
  const r1 = rise(0.15), r2 = rise(0.3), r3 = rise(0.55), r4 = rise(0.72), r5 = rise(0.9);
  return (
    <>
      <div {...r1} className={clsx(r1.className, "flex flex-wrap items-center gap-x-4 gap-y-3")}>
        <span className="pill pill-dark !py-1.5 !text-[0.72rem]"><span aria-hidden className="live-dot" /> Now boarding · Delhi → 5 iconic stops</span>
        <span className="eyebrow text-halo !text-[0.72rem] !tracking-[0.2em] !text-navy">Your journey, thoughtfully planned</span>
      </div>
      <h1 {...r2} className={clsx(r2.className, "mt-5 text-display-xl text-balance !text-midnight")}>
        India, <em className="not-italic" style={{ fontVariationSettings: '"opsz" 144, "SOFT" 100' }}>seen</em> differently.
      </h1>
      <p {...r3} className={clsx(r3.className, "mist-pad mt-6 max-w-[31rem] text-lede font-medium text-ink/85")}>
        Discover thoughtfully planned tours, iconic Indian destinations and comfortable travel experiences with NUAB Tourism.
      </p>
      <div {...r4} className={clsx(r4.className, "mt-8 flex flex-wrap gap-3")}>
        <Link href="#tours" className="btn btn-primary shadow-[0_14px_30px_-14px_rgb(23_43_61/.7)]">
          Explore our tours <ArrowRight className="size-4" aria-hidden />
        </Link>
        <Link href="#atlas" className="btn border border-navy/25 bg-white/85 text-navy shadow-[0_10px_24px_-16px_rgb(23_43_61/.5)] hover:border-navy hover:bg-white">
          Find your destination
        </Link>
      </div>
      <ul {...r5} className={clsx(r5.className, "mt-7 flex flex-wrap gap-2")} aria-label="What we offer">
        {SERVICES.map((s, i) => (
          <li key={s.href}>
            <Link href={s.href} className="pill shadow-[0_6px_16px_-10px_rgb(23_43_61/.45)]">
              <span aria-hidden className="font-mono text-[0.62rem] text-coral">0{i + 1}</span> {s.label}
            </Link>
          </li>
        ))}
      </ul>
      <p {...r5} className={clsx(r5.className, "coord text-halo mt-6 hidden !text-navy/60 sm:block")}>{coord} — DEPARTING DELHI · IATA REGISTERED</p>
    </>
  );
}

function HeroPanel({ coord }: { coord: string }) {
  return (
    <div data-panel="hero" className="absolute inset-0 flex items-end pb-[5svh] md:items-center md:pb-0">
      {/* warm paper haze behind the copy: readable over sky without washing out the scene */}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_8%_60%,rgb(246_242_234/.9),rgb(246_242_234/.55)_45%,transparent_72%)] md:bg-[radial-gradient(ellipse_48%_70%_at_14%_56%,rgb(246_242_234/.86),rgb(246_242_234/.5)_48%,transparent_76%)]" />
      <div className="container-x relative">
        <div className="max-w-[38rem] pt-24">
          <HeroCopy coord={coord} animate />
        </div>
      </div>
    </div>
  );
}

function StopPanel({ stop, current, index }: { stop: StopVM; current: boolean; index: number }) {
  const right = stop.layout === "right";
  const stops_index = () => index;
  return (
    <article
      data-panel={stop.id}
      aria-labelledby={`stop-${stop.id}`}
      className="invisible absolute inset-0 opacity-0"
      aria-hidden={!current}
    >
      <div className={clsx("absolute inset-x-0 bottom-0 md:inset-y-0 md:flex md:items-center md:pb-4 md:pt-24", right ? "md:justify-end" : "md:justify-start")}>
        <div className="container-x md:!max-w-none md:px-[max(2.5rem,calc((100vw-82rem)/2+2.5rem))]">
          {/* solid editorial card: reliable contrast over any sky or engraving */}
          <div className={clsx("relative max-w-[35rem] border border-t-2 border-line border-t-coral bg-ivory px-5 pb-6 pt-5 md:px-8 md:pb-7 md:pt-6", right && "md:ml-auto")}>
            <StopBody stop={stop} headingLevel="h2" compact index={stops_index()} />
          </div>
        </div>
      </div>
      {/* where a real 3D model stands, it is the landmark; the photo postcard would only cover it */}
      {stop.photo && !stop.hasModel && (
        <Postcard photo={stop.photo} title={stop.title} className={clsx("absolute top-[16%] hidden w-[17rem] lg:block xl:w-[19.5rem]", right ? "left-[4%]" : "right-[7%]")} />
      )}
    </article>
  );
}

export function StopBody({ stop, headingLevel = "h2", compact = false, index, total = 5 }: { stop: StopVM; headingLevel?: "h2" | "h3"; compact?: boolean; index?: number; total?: number }) {
  const H = headingLevel;
  const { openEnquiry } = useEnquiry();
  return (
    <>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        {index != null && (
          <p className="flex items-baseline gap-1.5" aria-label={`Stop ${index} of ${total}`}>
            <span className="index-num text-[2.1rem]">{String(index).padStart(2, "0")}</span>
            <span className="font-mono text-[0.7rem] text-muted">/ {String(total).padStart(2, "0")}</span>
          </p>
        )}
        <p className="coord">{stop.coord} — {stop.place}</p>
      </div>
      <p className="mt-4"><span className="pill pill-coral">{stop.kicker}</span></p>
      <H id={`stop-${stop.id}`} className="mt-2 text-display-lg text-balance">{stop.title}</H>
      <p className={clsx("mt-4 text-[1.02rem] leading-relaxed text-ink/85", compact && "line-clamp-3 md:line-clamp-4")}>{stop.intro}</p>
      <TourList tours={compact ? stop.tours.slice(0, 3) : stop.tours} className="mt-6" compactOnMobile={compact} />
      <div className="mt-6 flex flex-wrap gap-3">
        <Link href={stop.destinationHref} className="btn btn-primary">
          Explore {stop.destinationLabel} <ArrowRight className="size-4" aria-hidden />
        </Link>
        <button type="button" className="btn btn-ghost bg-white/60" onClick={() => openEnquiry(`${stop.title} tours`)}>
          Enquire
        </button>
      </div>
    </>
  );
}

export function TourList({ tours, className, compactOnMobile = false }: { tours: TourVM[]; className?: string; compactOnMobile?: boolean }) {
  return (
    <ul className={clsx("divide-y divide-line border-y border-line", className)}>
      {tours.map((t, i) => (
        <li key={t.href} className={clsx("flex items-center gap-4 py-3", compactOnMobile && i > 1 && "hidden md:flex")}>
          <div className="min-w-0 flex-1">
            <Link href={t.href} className="block truncate text-[0.95rem] font-semibold text-navy hover:underline underline-offset-4">
              {t.title}
            </Link>
            <p className="mt-0.5 font-mono text-[0.68rem] uppercase tracking-[0.08em] text-muted">{t.kind} · {t.duration}</p>
          </div>
          <div className="shrink-0 text-right">
            {t.price ? (
              <>
                <p className="text-[0.95rem] font-semibold text-ink">{t.price}</p>
                <p className="text-[0.7rem] text-muted">{t.basis}</p>
              </>
            ) : (
              <p className="text-[0.75rem] text-muted">Price on enquiry</p>
            )}
          </div>
          {t.booking && (
            <a href={t.booking} target="_blank" rel="noopener noreferrer" className="hidden shrink-0 items-center gap-1 border border-navy/30 px-2.5 py-1.5 text-[0.75rem] font-semibold text-navy hover:border-navy sm:inline-flex" aria-label={`Book ${t.title} (opens booking site)`}>
              Book <ArrowUpRight className="size-3.5" aria-hidden />
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}

export function Postcard({ photo, title, className }: { photo: PhotoVM; title: string; className?: string }) {
  return (
    <figure data-postcard className={clsx("border border-line bg-white p-2.5 shadow-[0_30px_60px_-30px_rgb(24_42_59/.45)]", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photo.src} srcSet={photo.srcSet} sizes="18rem" alt={photo.alt || title} loading="lazy" decoding="async" className="aspect-[4/3] w-full object-cover" />
      <figcaption className="mt-2 flex items-baseline justify-between gap-2 px-0.5">
        <span className="font-display text-[0.95rem] italic text-navy">{title}</span>
        <a href={photo.creditUrl ?? undefined} target="_blank" rel="noopener noreferrer" className="truncate font-mono text-[0.58rem] uppercase tracking-wide text-stone hover:text-navy">
          {photo.credit} · {photo.license}
        </a>
      </figcaption>
    </figure>
  );
}

function ArrivalPanel({ destinationCount, current }: { destinationCount: number; current: boolean }) {
  return (
    <div data-panel="arrival" aria-hidden={!current} className="invisible absolute inset-0 flex items-center justify-center opacity-0">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgb(255_255_255/.85),rgb(255_255_255/.35)_55%,transparent_75%)]" />
      <div className="relative max-w-2xl px-6 text-center">
        <p className="coord">30°45′ N · 78°24′ E — GARHWAL HIMALAYA</p>
        <h2 className="mt-5 text-display-lg text-balance">The atlas is yours.</h2>
        <p className="mx-auto mt-5 max-w-xl text-lede text-ink/80">
          {destinationCount} places NUAB Tourism travels to — day tours, multi-day packages, outstation cabs, road-trip guides and holidays in Dubai and Thailand — each at its true coordinates.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="#atlas" className="btn btn-primary">Open the atlas <ArrowDown className="size-4" aria-hidden /></Link>
          <Link href="/tours/" className="btn btn-ghost bg-white/70">All tours &amp; prices</Link>
        </div>
      </div>
    </div>
  );
}

function ProgressRail({ stops, fill, current, onGo }: { stops: StopVM[]; fill: React.RefObject<HTMLDivElement | null>; current: string; onGo: (p: number) => void }) {
  return (
    <nav aria-label="Journey stops" className="absolute right-4 top-1/2 hidden -translate-y-1/2 lg:block xl:right-8">
      <div className="relative h-[46svh] w-px bg-navy/15">
        <div ref={fill} className="absolute inset-x-0 top-0 h-full origin-top scale-y-0 bg-navy" />
        {stops.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onGo(s.p)}
            className="group absolute right-0 flex -translate-y-1/2 translate-x-1/2 items-center"
            style={{ top: `${s.p * 100}%` }}
            aria-current={current === s.id ? "step" : undefined}
            aria-label={`Fly to ${s.title}`}
          >
            <span className={clsx("block size-2.5 rounded-full border transition-colors", current === s.id ? "border-navy bg-navy" : "border-navy/60 bg-white group-hover:bg-navy")} />
            <span className={clsx("pointer-events-none absolute right-5 whitespace-nowrap font-mono text-[0.64rem] uppercase tracking-[0.14em] transition-opacity", current === s.id ? "text-navy opacity-100" : "text-navy/70 opacity-0 group-hover:opacity-100")}>
              {s.title}
            </span>
          </button>
        ))}
      </div>
    </nav>
  );
}

// ===========================================================================
// Static (SSR, reduced motion, no WebGL) — the complete journey without motion
// ===========================================================================
function StaticJourney({ stops, heroCoord, note }: { stops: StopVM[]; heroCoord: string; note: string | null }) {
  return (
    <section id="journey" aria-label="The NUAB journey" className="bg-white">
      <div className="sky-hero relative overflow-hidden pt-36 pb-[clamp(9rem,18vw,15rem)] md:pt-44">
        {/* engraved skyline on the horizon, behind the aircraft */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-center gap-6 px-6 text-sand-deep/55">
          <Engraving id="hawa-mahal" className="w-[22%] max-w-80" weight={1.2} />
          <Engraving id="india-gate" className="w-[16%] max-w-60" weight={1.2} />
          <Engraving id="taj-mahal" className="w-[26%] max-w-96" weight={1.2} />
          <Engraving id="temple" className="hidden w-[16%] max-w-60 sm:block" weight={1.2} />
        </div>
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_55%_75%_at_12%_50%,rgb(246_242_234/.88),rgb(246_242_234/.45)_50%,transparent_78%)]" />
        <div className="container-x relative grid items-center gap-12 lg:grid-cols-[1fr_1.1fr]">
          <div>
            <HeroCopy coord={heroCoord} animate={false} />
            {note && <p className="mt-4 text-xs text-navy/70">{note}</p>}
          </div>
          <figure className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/media/aircraft-hero.png" alt="The NUAB Tourism aircraft in white and navy livery" className="relative w-full drop-shadow-[0_30px_40px_rgb(23_43_61/.25)]" width={1600} height={568} />
          </figure>
        </div>
      </div>
      <ol className="container-x divide-y divide-line">
        {stops.map((s, i) => (
          <li key={s.id} id={`stop-${s.id}`} className="grid gap-10 py-20 lg:grid-cols-2 lg:gap-16">
            <div className={clsx(i % 2 === 1 && "lg:order-2")}>
              <StopBody stop={s} headingLevel="h2" index={i + 1} total={stops.length} />
            </div>
            <div className="relative">
              <Engraving id={s.engraving} className="w-full text-navy/80" title={`Engraving of ${s.title}`} weight={1.3} />
              {s.photo && <Postcard photo={s.photo} title={s.title} className="relative -mt-16 ml-auto w-[min(22rem,85%)] rotate-[-1.5deg]" />}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
