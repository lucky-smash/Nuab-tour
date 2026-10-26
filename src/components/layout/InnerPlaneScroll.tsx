"use client";

import { useEffect } from "react";
import { PLANE_PATH } from "@/lib/plane";

/**
 * The airplane scrollbar for the site's inner scrolling areas — the atlas list and detail panel, the
 * mobile menu drawer, the enquiry dialog, and any future `overflow-y-auto` box — matching the page's
 * own AirplaneScrollController at a smaller size. Boxes are found automatically (opt out with
 * `data-plane-scroll="off"`), so components need no changes, and React-rendered elements are never
 * touched (their native scrollbars are hidden by CSS under html.asc-on): each box gets a fixed
 * overlay laid over its right edge, appended to <body> — or, while it is open, to the box's <dialog>
 * so it shares the top layer. Scanning starts once the page is loaded and idle, after hydration. The
 * box keeps its native scrolling and keyboard behaviour; the overlay only mirrors it and turns drags
 * into scrollTop. Decorative for assistive technology (the box itself stays the scrollable region).
 */
const SELECTOR = ".overflow-y-auto, [data-plane-scroll]";
const W = 26, HIT = 28, PAD = 4;

type Inner = { update: () => void; detach: () => void };

function attach(box: HTMLElement): Inner {
  const host = box.closest("dialog") ?? document.body;
  const inHeader = !!box.closest("header");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const el = document.createElement("div");
  el.className = "asi";
  el.setAttribute("aria-hidden", "true");
  el.innerHTML =
    `<div class="asi-route"></div><div class="asi-trail"></div>` +
    `<div class="asi-handle"><span class="asi-lift"><svg class="asi-plane" viewBox="0 0 64 64" width="15" height="15"><path d="${PLANE_PATH}"/></svg></span></div>`;
  host.appendChild(el);
  const handle = el.querySelector<HTMLElement>(".asi-handle")!;
  const trail = el.querySelector<HTMLElement>(".asi-trail")!;
  const plane = el.querySelector<SVGElement>(".asi-plane")!;

  let len = 1, max = 0, top = 0, lastTop = box.scrollTop, dir = 1;
  let idle: ReturnType<typeof setTimeout> | undefined;
  const update = () => {
    const r = box.getBoundingClientRect();
    max = box.scrollHeight - box.clientHeight;
    const headerBottom = inHeader ? 0 : document.querySelector("header")?.getBoundingClientRect().bottom ?? 0;
    top = Math.max(r.top, headerBottom) + PAD;
    const bottom = Math.min(r.bottom, window.innerHeight) - PAD;
    const h = bottom - top;
    let show = max > 4 && r.width > 0 && h > 64 && box.isConnected;
    if (show) {
      // only while the box is what's actually on screen there (not under the menu drawer, say)
      const hit = document.elementFromPoint(r.left + Math.min(r.width / 2, 40), (top + bottom) / 2);
      show = !!hit && (box.contains(hit) || el.contains(hit));
    }
    el.toggleAttribute("data-empty", !show);
    if (!show) return;
    len = h - HIT;
    el.style.transform = `translate3d(${Math.round(r.right - W - 2)}px, ${Math.round(top)}px, 0)`;
    el.style.height = `${Math.round(h)}px`;
    const p = Math.min(1, Math.max(0, box.scrollTop / max));
    const offset = Math.round(p * len);
    handle.style.transform = `translate3d(0, ${offset}px, 0)`;
    trail.style.clipPath = `inset(0 0 ${Math.max(0, len - offset)}px 0)`;
    if (Math.abs(box.scrollTop - lastTop) > 0.5) dir = box.scrollTop > lastTop ? 1 : -1;
    lastTop = box.scrollTop;
    plane.style.transform = `rotate(${dir > 0 ? 180 : 0}deg)`;
  };
  let raf = 0;
  const schedule = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; update(); }); };
  const onScroll = () => {
    schedule();
    el.setAttribute("data-active", "");
    clearTimeout(idle);
    idle = setTimeout(() => el.removeAttribute("data-active"), 1100);
  };

  // drag the plane (or press the route) -> scrollTop
  let dragging = false, grab = 0, captor: Element = el;
  const toPointer = (clientY: number) => {
    box.scrollTo({ top: Math.min(1, Math.max(0, (clientY - grab - top - HIT / 2) / len)) * max, behavior: "instant" });
  };
  const onDown = (e: PointerEvent) => {
    if (e.button !== 0 || max <= 0) return;
    e.preventDefault();
    e.stopPropagation(); // the atlas map and dialogs must not read this as their own click
    const onPlane = handle.contains(e.target as Node);
    grab = onPlane ? e.clientY - (handle.getBoundingClientRect().top + HIT / 2) : 0;
    dragging = true;
    captor = onPlane ? handle : el;
    captor.setPointerCapture(e.pointerId);
    el.setAttribute("data-dragging", "");
    document.documentElement.classList.add("asc-dragging");
    if (!grab) toPointer(e.clientY);
  };
  const onMove = (e: PointerEvent) => { if (dragging) toPointer(e.clientY); };
  const onUp = (e: PointerEvent) => {
    if (!dragging) return;
    dragging = false;
    if (captor.hasPointerCapture(e.pointerId)) captor.releasePointerCapture(e.pointerId);
    el.removeAttribute("data-dragging");
    document.documentElement.classList.remove("asc-dragging");
  };
  const stopClick = (e: Event) => e.stopPropagation();

  const ro = new ResizeObserver(schedule);
  ro.observe(box);
  const mo = new MutationObserver(schedule); // filtering the list changes its scroll height
  mo.observe(box, { childList: true, subtree: true });
  box.addEventListener("scroll", onScroll, { passive: true });
  el.addEventListener("pointerdown", onDown);
  el.addEventListener("pointermove", onMove);
  el.addEventListener("pointerup", onUp);
  el.addEventListener("pointercancel", onUp);
  el.addEventListener("click", stopClick);
  if (reduced) plane.style.transition = "none";
  update();

  return {
    update: schedule,
    detach() {
      cancelAnimationFrame(raf);
      clearTimeout(idle);
      ro.disconnect();
      mo.disconnect();
      box.removeEventListener("scroll", onScroll);
      el.remove();
    },
  };
}

export function InnerPlaneScroll() {
  useEffect(() => {
    const live = new Map<HTMLElement, Inner>();
    const scan = () => {
      const closed = (box: HTMLElement) => { const d = box.closest("dialog"); return !!d && !d.open; };
      for (const [box, inner] of live) if (!box.isConnected || closed(box)) { inner.detach(); live.delete(box); }
      document.querySelectorAll<HTMLElement>(SELECTOR).forEach((box) => {
        if (live.has(box) || box.dataset.planeScroll === "off" || closed(box)) return;
        live.set(box, attach(box));
      });
      live.forEach((inner) => inner.update());
    };
    let raf = 0;
    const rescan = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; scan(); }); };
    const updateAll = () => live.forEach((inner) => inner.update());
    // panels mount and unmount (atlas detail, drawer), dialogs open and close
    const mo = new MutationObserver(rescan);
    window.addEventListener("scroll", updateAll, { passive: true });
    window.addEventListener("resize", updateAll);
    // start after the page has loaded and gone idle, well after hydration
    let started = false, idleId = 0;
    const start = () => {
      const go = () => { if (!started) { started = true; mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["open", "hidden"] }); scan(); } };
      idleId = typeof window.requestIdleCallback === "function" ? window.requestIdleCallback(go, { timeout: 1500 }) : window.setTimeout(go, 300);
    };
    if (document.readyState === "complete") start();
    else window.addEventListener("load", start, { once: true });
    return () => {
      cancelAnimationFrame(raf);
      if (typeof window.cancelIdleCallback === "function") window.cancelIdleCallback(idleId);
      clearTimeout(idleId);
      window.removeEventListener("load", start);
      mo.disconnect();
      window.removeEventListener("scroll", updateAll);
      window.removeEventListener("resize", updateAll);
      live.forEach((inner) => inner.detach());
    };
  }, []);
  return null;
}
