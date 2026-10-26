"use client";

import Link from "next/link";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, ArrowUpRight, Car, Crosshair, MapPin, Plane, Search, X } from "lucide-react";
import { clsx } from "@/lib/site";
import type { AtlasDest } from "./atlasData";
import { MapView, type MapStatus, type ViewKey } from "./MapView";

const REGION_GROUPS: { id: string; label: string; match: (d: AtlasDest) => boolean; view: ViewKey }[] = [
  { id: "all", label: "Everywhere", match: () => true, view: "all" },
  { id: "north", label: "North India", match: (d) => d.country === "India", view: "india" },
  { id: "himalaya", label: "Himalaya", match: (d) => ["Himachal Pradesh", "Uttarakhand", "Jammu & Kashmir"].includes(d.region), view: "himalaya" },
  { id: "uae", label: "Dubai & UAE", match: (d) => d.country === "UAE", view: "uae" },
  { id: "thailand", label: "Thailand", match: (d) => d.country === "Thailand", view: "thailand" },
];
const THEMES = [
  ["heritage", "Heritage"],
  ["spiritual", "Spiritual"],
  ["hills", "Hills"],
  ["nature", "Nature"],
  ["adventure", "Adventure"],
  ["beach", "Beaches"],
  ["city", "Cities"],
] as const;
const MODES = [
  ["day-tour", "Same-day tours"],
  ["multi-day", "Multi-day"],
  ["cab", "Outstation cabs"],
  ["road-trip", "Road trips"],
  ["international", "International"],
] as const;

export function Atlas({ dests, line, title = "Find your destination", headingLevel = "h2" }: { dests: AtlasDest[]; line: [number, number][]; title?: string; headingLevel?: "h1" | "h2" }) {
  const [query, setQuery] = useState("");
  const q = useDeferredValue(query.trim().toLowerCase());
  const [region, setRegion] = useState("north");
  const [themes, setThemes] = useState<Set<string>>(new Set());
  const [modes, setModes] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<string | null>(null);
  const [status, setStatus] = useState<MapStatus>("loading");
  const [viewRequest, setViewRequest] = useState<{ key: ViewKey | "fit"; n: number }>({ key: "india", n: 0 });
  const listRef = useRef<HTMLUListElement>(null);
  const mapWrap = useRef<HTMLDivElement>(null);

  // deep link: /destinations/?d=agra or #atlas-agra
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("d");
    const hit = p ? dests.find((d) => d.id === p) : undefined;
    if (hit) {
      // widen the region filter so a deep-linked destination outside North India stays selectable
      if (hit.country !== "India") setRegion("all");
      setSelected(hit.id);
    }
  }, [dests]);

  const filtered = useMemo(() => {
    const group = REGION_GROUPS.find((g) => g.id === region)!;
    return dests.filter((d) => {
      if (!group.match(d)) return false;
      if (themes.size && !d.themes.some((t) => themes.has(t))) return false;
      if (modes.size && !d.modes.some((m) => modes.has(m))) return false;
      if (!q) return true;
      const hay = [d.name, d.sourceName ?? "", d.region, d.country, ...d.attractions, ...d.tours.map((t) => t.title), ...d.packages.map((p) => p.title), d.summary].join(" ").toLowerCase();
      return q.split(/\s+/).every((w) => hay.includes(w));
    }).sort((a, b) => Number(b.featured) - Number(a.featured) || a.name.localeCompare(b.name));
  }, [dests, region, themes, modes, q]);

  const visibleIds = useMemo(() => new Set(filtered.map((d) => d.id)), [filtered]);
  const current = selected ? dests.find((d) => d.id === selected) ?? null : null;

  // keep the selection within the filtered set
  useEffect(() => {
    if (selected && !visibleIds.has(selected)) setSelected(null);
  }, [visibleIds, selected]);

  // when filters change (not on selection), frame the results
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    setViewRequest((v) => ({ key: q || themes.size || modes.size ? "fit" : REGION_GROUPS.find((g) => g.id === region)!.view, n: v.n + 1 }));
  }, [region, themes, modes, q]);

  const select = useCallback((id: string | null, from: "map" | "list") => {
    setSelected(id);
    if (id && from === "map") {
      const el = listRef.current?.querySelector<HTMLElement>(`[data-id="${id}"]`);
      el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
    if (id && from === "list" && window.innerWidth < 1024) {
      mapWrap.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    }
  }, []);

  const toggle = (set: Set<string>, v: string, fn: (s: Set<string>) => void) => {
    const n = new Set(set);
    if (n.has(v)) n.delete(v); else n.add(v);
    fn(n);
  };
  const reset = () => { setQuery(""); setThemes(new Set()); setModes(new Set()); setRegion("north"); setSelected(null); setViewRequest((v) => ({ key: "india", n: v.n + 1 })); };
  const H = headingLevel;

  return (
    <div className="grid grid-cols-1 gap-0 lg:grid-cols-[minmax(22rem,26rem)_minmax(0,1fr)] lg:items-start lg:border lg:border-line">
      {/* Directory */}
      <div className="flex min-h-0 min-w-0 flex-col border-line lg:border-r">
        <div className="space-y-4 border-b border-line bg-white p-5">
          <div>
            <p className="eyebrow">The atlas · {dests.length} destinations</p>
            <H className="mt-2 text-display-sm">{title}</H>
          </div>
          <label className="relative block">
            <span className="sr-only">Search destinations, attractions or tours</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search Taj Mahal, Rishikesh, Phuket…"
              className="h-11 w-full border border-line bg-mist pl-9 pr-9 text-[0.95rem] outline-none transition-colors placeholder:text-muted focus:border-navy focus:bg-white"
            />
            {query && (
              <button type="button" onClick={() => setQuery("")} className="absolute right-2 top-1/2 inline-flex size-7 -translate-y-1/2 items-center justify-center text-muted hover:text-navy" aria-label="Clear search">
                <X className="size-4" />
              </button>
            )}
          </label>
          <fieldset>
            <legend className="sr-only">Region</legend>
            <div className="flex flex-wrap gap-1.5">
              {REGION_GROUPS.map((g) => (
                <Chip key={g.id} active={region === g.id} onClick={() => setRegion(g.id)} radio>{g.label}</Chip>
              ))}
            </div>
          </fieldset>
          <details className="group" open>
            <summary className="flex cursor-pointer list-none items-center justify-between font-mono text-[0.68rem] uppercase tracking-[0.16em] text-muted">
              Refine <span className="text-stone transition-transform group-open:rotate-45">+</span>
            </summary>
            <fieldset className="mt-3">
              <legend className="mb-1.5 text-[0.75rem] font-semibold text-ink">Travel style</legend>
              <div className="flex flex-wrap gap-1.5">
                {MODES.map(([id, label]) => (
                  <Chip key={id} active={modes.has(id)} onClick={() => toggle(modes, id, setModes)}>{label}</Chip>
                ))}
              </div>
            </fieldset>
            <fieldset className="mt-3">
              <legend className="mb-1.5 text-[0.75rem] font-semibold text-ink">Theme</legend>
              <div className="flex flex-wrap gap-1.5">
                {THEMES.map(([id, label]) => (
                  <Chip key={id} active={themes.has(id)} onClick={() => toggle(themes, id, setThemes)}>{label}</Chip>
                ))}
              </div>
            </fieldset>
          </details>
          <div className="flex items-center justify-between text-[0.8rem] text-muted" aria-live="polite">
            <span><strong className="font-semibold text-ink">{filtered.length}</strong> {filtered.length === 1 ? "destination" : "destinations"}</span>
            {(query || themes.size > 0 || modes.size > 0 || region !== "north") && (
              <button type="button" onClick={reset} className="link-underline text-navy">Reset</button>
            )}
          </div>
        </div>
        <ul ref={listRef} className="max-h-[26rem] divide-y divide-line overflow-y-auto overscroll-contain bg-white lg:max-h-[min(44rem,calc(100svh-17rem))] lg:flex-1" aria-label="Destinations">
          {filtered.map((d) => (
            <li key={d.id} data-id={d.id}>
              <button
                type="button"
                onClick={() => select(d.id === selected ? null : d.id, "list")}
                aria-pressed={d.id === selected}
                className={clsx("group flex w-full items-center gap-4 px-5 py-3.5 text-left transition-colors", d.id === selected ? "bg-powder/70" : "hover:bg-mist")}
              >
                <span className={clsx("flex size-9 shrink-0 items-center justify-center rounded-full border text-navy", d.id === selected ? "border-navy bg-white" : "border-line")}>
                  <MapPin className="size-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <span className="truncate font-display text-[1.15rem] text-navy">{d.name}</span>
                    {d.featured && <span className="font-mono text-[0.58rem] uppercase tracking-[0.14em] text-stone">Journey</span>}
                  </span>
                  <span className="block truncate font-mono text-[0.66rem] uppercase tracking-[0.08em] text-muted">{d.region} · {d.coord}</span>
                </span>
                {d.priceLabel && (
                  <span className="shrink-0 text-right text-[0.8rem]">
                    <span className="block font-semibold text-ink">{d.priceLabel}</span>
                    <span className="block text-[0.68rem] text-muted">{d.priceBasis}</span>
                  </span>
                )}
              </button>
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="px-5 py-10 text-center text-sm text-muted">
              No destinations match. <button type="button" className="link-underline text-navy" onClick={reset}>Clear filters</button>
            </li>
          )}
        </ul>
      </div>

      {/* Map + detail */}
      <div ref={mapWrap} className="relative h-[68svh] min-h-[28rem] scroll-mt-24 bg-mist lg:sticky lg:top-24 lg:h-[calc(100svh-7rem)] lg:min-h-[36rem]">
        <MapView
          dests={dests}
          visibleIds={visibleIds}
          selectedId={selected}
          onSelect={(id) => select(id, "map")}
          line={line}
          viewRequest={viewRequest}
          onStatus={setStatus}
        />
        {status === "failed" && (
          <div className="absolute inset-0 flex items-center justify-center bg-mist p-8 text-center">
            <div className="max-w-sm">
              <p className="eyebrow">Map unavailable</p>
              <p className="mt-3 text-sm text-muted">The interactive map could not load on this connection. Every destination, tour and price is still listed in the directory.</p>
            </div>
          </div>
        )}
        {status !== "failed" && (
          <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap gap-1.5">
            {(["india", "himalaya", "uae", "thailand"] as ViewKey[]).map((k) => (
              <button key={k} type="button" onClick={() => setViewRequest((v) => ({ key: k, n: v.n + 1 }))} className="pointer-events-auto border border-line bg-white/92 px-2.5 py-1.5 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-navy backdrop-blur hover:border-navy">
                {k === "india" ? "North India" : k === "himalaya" ? "Himalaya" : k === "uae" ? "UAE" : "Thailand"}
              </button>
            ))}
            <button type="button" onClick={() => { setSelected(null); setViewRequest((v) => ({ key: "fit", n: v.n + 1 })); }} className="pointer-events-auto inline-flex items-center gap-1 border border-line bg-white/92 px-2.5 py-1.5 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-navy backdrop-blur hover:border-navy" aria-label="Reset map to show all results">
              <Crosshair className="size-3" aria-hidden /> Reset
            </button>
          </div>
        )}
        <Legend />
        {current && <DetailPanel d={current} onClose={() => setSelected(null)} />}
      </div>
    </div>
  );
}

function Chip({ active, onClick, children, radio = false }: { active: boolean; onClick: () => void; children: React.ReactNode; radio?: boolean }) {
  return (
    <button
      type="button"
      role={radio ? "radio" : undefined}
      aria-checked={radio ? active : undefined}
      aria-pressed={radio ? undefined : active}
      onClick={onClick}
      className={clsx("border px-2.5 py-1 text-[0.78rem] transition-colors", active ? "border-navy bg-navy text-white" : "border-line bg-white text-ink hover:border-navy/50")}
    >
      {children}
    </button>
  );
}

function Legend() {
  return (
    <div className="pointer-events-none absolute bottom-8 left-3 hidden border border-line bg-white/92 px-3 py-2.5 backdrop-blur sm:block">
      <ul className="space-y-1.5 font-mono text-[0.6rem] uppercase tracking-[0.12em] text-muted">
        <li className="flex items-center gap-2"><span className="inline-block size-2.5 rounded-full border-2 border-navy bg-white" /> Featured journey stop</li>
        <li className="flex items-center gap-2"><span className="inline-block size-2 rounded-full bg-navy" /> Destination</li>
        <li className="flex items-center gap-2"><span className="inline-block w-5 border-t border-dashed border-navy" /> Journey line (illustrative, not a road)</li>
        <li className="flex items-center gap-2"><Plane className="size-3 rotate-45 text-navy" aria-hidden /> Flights from Delhi (illustrative)</li>
      </ul>
    </div>
  );
}

function DetailPanel({ d, onClose }: { d: AtlasDest; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: 0 });
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [d.id, onClose]);
  return (
    <aside
      ref={ref}
      aria-label={`${d.name} details`}
      className="absolute inset-x-2 bottom-2 max-h-[72%] overflow-y-auto border border-line bg-white shadow-[0_30px_60px_-30px_rgb(24_42_59/.5)] sm:inset-x-auto sm:right-3 sm:top-3 sm:bottom-3 sm:max-h-none sm:w-[24rem]"
    >
      {d.image && (
        <figure className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={d.image.src} srcSet={d.image.srcSet} sizes="24rem" alt={d.image.alt} className="aspect-[16/9] w-full object-cover" loading="lazy" />
          {d.image.credit && (
            <figcaption className="absolute bottom-0 right-0 bg-white/85 px-2 py-0.5 font-mono text-[0.55rem] uppercase tracking-wide text-muted">
              {d.image.creditUrl ? <a href={d.image.creditUrl} target="_blank" rel="noopener noreferrer" className="hover:text-navy">{d.image.credit}</a> : d.image.credit}
            </figcaption>
          )}
        </figure>
      )}
      <button type="button" onClick={onClose} className="absolute right-2 top-2 inline-flex size-9 items-center justify-center bg-white/90 text-navy hover:bg-white" aria-label="Close destination panel">
        <X className="size-4" />
      </button>
      <div className="p-5">
        <p className="coord">{d.coord} — {d.region.toUpperCase()}</p>
        <h3 className="mt-2 text-display-sm">{d.name}{d.sourceName && <span className="ml-2 font-mono text-xs text-stone">(listed as “{d.sourceName}”)</span>}</h3>
        {d.distanceLabel && <p className="mt-1 font-mono text-[0.68rem] uppercase tracking-[0.1em] text-muted">{d.distanceLabel}</p>}
        {d.summary && <p className="mt-3 text-[0.92rem] leading-relaxed text-ink/85">{d.summary}</p>}
        {d.attractions.length > 0 && (
          <div className="mt-4">
            <p className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-stone">Highlights</p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {d.attractions.map((a) => (
                <li key={a} className="border border-line px-2 py-0.5 text-[0.75rem] text-ink">{a}</li>
              ))}
            </ul>
          </div>
        )}
        {d.tours.length > 0 && (
          <div className="mt-5">
            <p className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-stone">Tours & packages</p>
            <ul className="mt-2 divide-y divide-line border-y border-line">
              {d.tours.map((t) => (
                <li key={t.href} className="py-2.5">
                  <Link href={t.href} className="flex items-start justify-between gap-3 hover:text-navy">
                    <span className="min-w-0">
                      <span className="block text-[0.88rem] font-semibold text-navy">{t.title}</span>
                      <span className="block font-mono text-[0.6rem] uppercase tracking-[0.08em] text-muted">{t.duration}</span>
                    </span>
                    <span className="shrink-0 text-right text-[0.8rem]">
                      {t.price ? <><span className="block font-semibold text-ink">{t.price}</span><span className="block text-[0.66rem] text-muted">{t.basis}</span></> : <span className="text-muted">On enquiry</span>}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
        {d.cabs.length > 0 && (
          <div className="mt-5">
            <p className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-stone">Outstation cab</p>
            <ul className="mt-2 space-y-2">
              {d.cabs.map((c) => (
                <li key={c.label} className="border border-line p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-[0.88rem] font-semibold text-navy"><Car className="size-4" aria-hidden /> {c.label}</span>
                    <span className="text-[0.8rem] font-semibold">{c.fare}</span>
                  </div>
                  <p className="mt-1 font-mono text-[0.62rem] uppercase tracking-[0.08em] text-muted">{c.distance} · approx. {c.time} by road</p>
                  <div className="mt-2 flex gap-3 text-[0.8rem]">
                    <a href={c.whatsapp} target="_blank" rel="noopener noreferrer" className="link-underline font-semibold text-navy">Book on WhatsApp</a>
                    <Link href={c.page} className="link-underline text-muted">Route details</Link>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
        {d.packages.length > 0 && (
          <div className="mt-5">
            <p className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-stone">Holiday packages</p>
            <ul className="mt-2 divide-y divide-line border-y border-line">
              {d.packages.map((p) => (
                <li key={p.href}>
                  <Link href={p.href} className="flex items-center justify-between gap-3 py-2.5 text-[0.88rem] hover:text-navy">
                    <span className="font-semibold text-navy">{p.title}</span>
                    <span className="shrink-0 font-mono text-[0.6rem] uppercase tracking-[0.08em] text-muted">{p.duration}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
        {d.roadTrip && (
          <p className="mt-5 text-[0.85rem] text-muted">
            Road-trip guide: <Link href={`/destinations/${d.id}/#road-trip`} className="link-underline text-navy">{d.roadTrip.title}</Link>
          </p>
        )}
        <div className="mt-6 flex flex-wrap gap-2">
          <Link href={d.href} className="btn btn-primary !min-h-10 !px-4 !text-[0.85rem]">View {d.name} <ArrowRight className="size-4" aria-hidden /></Link>
          {d.tours.find((t) => t.booking) && (
            <a href={d.tours.find((t) => t.booking)!.booking!} target="_blank" rel="noopener noreferrer" className="btn btn-ghost !min-h-10 !px-4 !text-[0.85rem]">Book online <ArrowUpRight className="size-4" aria-hidden /></a>
          )}
        </div>
      </div>
    </aside>
  );
}
