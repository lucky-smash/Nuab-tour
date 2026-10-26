"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { PLANE_PATH } from "@/lib/plane";

/**
 * The site's scrollbar, as a small airliner on a dotted route along the right edge. The page keeps
 * its native document scroll (wheel, trackpad, touch, keyboard, ScrollTrigger all untouched); the
 * plane only mirrors scroll progress, and dragging it (or pressing on the route) scrolls the
 * document. A navy contrail traces the distance flown, the nose turns with the direction of travel
 * and banks slightly with speed, and a label names the section in view (the journey's current stop
 * inside the journey). Everything high-frequency is written straight to the DOM — no React renders
 * while scrolling or dragging. The native scrollbar is hidden only once this has mounted, so without
 * script the page keeps its ordinary scrollbar. On touch screens the plane appears while the page
 * moves and can be caught then; otherwise it stays out of the way.
 */
const HIT = 44; // handle hit area (px); the visible plane is ~20 px inside it
const GAP_TOP = 10, GAP_BOTTOM = 14;

function sectionLabel(el: Element): string {
  if (el.id === "journey") {
    const stop = document.querySelector('nav[aria-label="Journey stops"] [aria-current]')?.getAttribute("aria-label");
    return stop ? stop.replace(/^Fly to\s+/, "") : "The journey";
  }
  const own = el.getAttribute("data-scroll-label") ?? el.getAttribute("aria-label");
  if (own && own.length <= 40) return own;
  const by = el.getAttribute("aria-labelledby");
  const heading = (by && document.getElementById(by)) || el.querySelector("h1, h2");
  const text = heading?.textContent?.replace(/\s+/g, " ").trim() || own || "";
  return text.length > 40 ? text.slice(0, 38).replace(/\s+\S*$/, "") + "…" : text;
}

export function AirplaneScrollController() {
  const root = useRef<HTMLDivElement>(null);
  const handle = useRef<HTMLDivElement>(null);
  const plane = useRef<SVGSVGElement>(null);
  const trail = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLSpanElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    const el = root.current, h = handle.current, pl = plane.current, tr = trail.current, lb = label.current;
    if (!el || !h || !pl || !tr || !lb) return;
    const doc = document.documentElement;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    doc.classList.add("asc-on");

    // ---- geometry (recomputed on resize / content changes, never per frame) ----------------------
    let top = 0, len = 1, max = 0;
    let sections: Element[] = [];
    const measure = () => {
      const header = document.querySelector("header");
      top = Math.round((header?.getBoundingClientRect().bottom ?? 0) + GAP_TOP);
      el.style.top = `${top}px`;
      len = Math.max(1, window.innerHeight - top - GAP_BOTTOM - HIT);
      max = Math.max(0, doc.scrollHeight - window.innerHeight);
      el.toggleAttribute("data-empty", max < 8 || len < 60);
      sections = Array.from(document.querySelectorAll("main section, main [data-scroll-label]")).filter((s) => !s.parentElement?.closest("section"));
      schedule();
    };

    // ---- scroll -> plane ------------------------------------------------------------------------
    let raf = 0, lastY = window.scrollY, lastT = performance.now(), dir = 1, tilt = 0, current = "";
    let idle: ReturnType<typeof setTimeout> | undefined;
    const update = () => {
      raf = 0;
      const y = window.scrollY, now = performance.now();
      const p = max > 0 ? Math.min(1, Math.max(0, y / max)) : 0;
      const dy = y - lastY, dt = Math.max(1, now - lastT);
      if (Math.abs(dy) > 0.5) dir = dy > 0 ? 1 : -1;
      tilt = reduced ? 0 : Math.max(-9, Math.min(9, (dy / dt) * 5));
      lastY = y;
      lastT = now;
      // section in view: the last one whose top has passed 40% of the viewport
      let name = "";
      for (const s of sections) if (s.getBoundingClientRect().top <= window.innerHeight * 0.4) name = sectionLabel(s);
      if (!name) name = (sections[0] && sectionLabel(sections[0])) || sectionLabel(document.querySelector("main") ?? doc); // above the first section: the page's own title
      const pct = Math.round(p * 100);
      if (!name) name = `${pct}%`;
      // writes
      const offset = Math.round(p * len);
      h.style.transform = `translate3d(0, ${offset}px, 0)`;
      tr.style.clipPath = `inset(0 0 ${Math.max(0, len - offset)}px 0)`;
      pl.style.transform = `rotate(${(dir > 0 ? 180 : 0) + tilt}deg)`;
      h.setAttribute("aria-valuenow", String(pct));
      if (name !== current) {
        current = name;
        lb.textContent = name;
      }
      h.setAttribute("aria-valuetext", `${name}, ${pct}% of the page`);
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(update); };
    const onScroll = () => {
      schedule();
      el.setAttribute("data-active", "");
      clearTimeout(idle);
      idle = setTimeout(() => {
        el.removeAttribute("data-active");
        tilt = 0;
        pl.style.transform = `rotate(${dir > 0 ? 180 : 0}deg)`; // level out once the page settles
      }, 1100);
    };

    // ---- drag (pointer events, captured) --------------------------------------------------------
    let dragging = false, grab = 0, captor: Element = el;
    const scrollToCenter = (clientY: number) => {
      const p = Math.min(1, Math.max(0, (clientY - grab - top - HIT / 2) / len));
      window.scrollTo({ top: p * max, behavior: "instant" });
    };
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 || max <= 0) return;
      e.preventDefault();
      const handleCenter = h.getBoundingClientRect().top + HIT / 2;
      // grabbing the plane keeps the hand where it took hold; pressing the route flies there
      const onPlane = h.contains(e.target as Node);
      grab = onPlane ? e.clientY - handleCenter : 0;
      dragging = true;
      captor = onPlane ? h : el; // on touch only the plane takes pointers, so it holds the capture
      captor.setPointerCapture(e.pointerId);
      el.setAttribute("data-dragging", "");
      doc.classList.add("asc-dragging");
      h.focus({ preventScroll: true });
      if (!grab) scrollToCenter(e.clientY);
    };
    const onMove = (e: PointerEvent) => { if (dragging) scrollToCenter(e.clientY); };
    const onUp = (e: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      if (captor.hasPointerCapture(e.pointerId)) captor.releasePointerCapture(e.pointerId);
      el.removeAttribute("data-dragging");
      doc.classList.remove("asc-dragging");
    };

    // ---- keyboard on the focused plane (slider semantics); page keys elsewhere stay native -------
    const onKey = (e: KeyboardEvent) => {
      const vh = window.innerHeight;
      const by: Record<string, number> = { ArrowDown: vh * 0.12, ArrowUp: -vh * 0.12, PageDown: vh * 0.9, PageUp: -vh * 0.9 };
      const behavior: ScrollBehavior = reduced ? "instant" : "smooth";
      if (e.key in by) window.scrollBy({ top: by[e.key], behavior });
      else if (e.key === "Home") window.scrollTo({ top: 0, behavior });
      else if (e.key === "End") window.scrollTo({ top: max, behavior });
      else return;
      e.preventDefault();
    };

    const ro = new ResizeObserver(measure);
    ro.observe(document.body);
    // the journey marks its current stop a moment after the scroll that reached it: relabel then
    const mo = new MutationObserver(schedule);
    const rail = document.querySelector('nav[aria-label="Journey stops"]');
    if (rail) mo.observe(rail, { subtree: true, attributeFilter: ["aria-current"] });
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", measure);
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    h.addEventListener("keydown", onKey);
    measure();
    el.removeAttribute("data-pending");

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(idle);
      ro.disconnect();
      mo.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", measure);
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      h.removeEventListener("keydown", onKey);
      doc.classList.remove("asc-on", "asc-dragging");
    };
  }, [pathname]);

  return (
    <div ref={root} className="asc" data-pending="" data-empty="">
      {/* the route: faint dots ahead, a navy contrail behind (clipped to the distance flown) */}
      <div className="asc-route" aria-hidden />
      <div ref={trail} className="asc-trail" aria-hidden />
      <span className="asc-cap asc-cap-top" aria-hidden />
      <span className="asc-cap asc-cap-bottom" aria-hidden />
      <div
        ref={handle}
        className="asc-handle"
        role="slider"
        tabIndex={0}
        aria-label="Page scroll position"
        aria-orientation="vertical"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={0}
      >
        <span className="asc-lift">
          <svg ref={plane} className="asc-plane" viewBox="0 0 64 64" width="22" height="22" aria-hidden>
            <path d={PLANE_PATH} />
          </svg>
        </span>
        <span ref={label} className="asc-label" aria-hidden />
      </div>
    </div>
  );
}
