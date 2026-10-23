"use client";

import { useEffect, useRef } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Map as MLMap, Marker as MLMarker, LngLatBoundsLike, StyleSpecification } from "maplibre-gl";
import type { AtlasDest } from "./atlasData";

export type MapStatus = "loading" | "ready" | "failed";
export type ViewKey = "india" | "himalaya" | "uae" | "thailand" | "all";

const STYLE_URL = process.env.NEXT_PUBLIC_MAP_STYLE_URL || "https://tiles.openfreemap.org/styles/positron";

const VIEWS: Record<Exclude<ViewKey, "all">, LngLatBoundsLike> = {
  india: [[74.6, 25.9], [80.0, 32.9]],
  himalaya: [[74.4, 29.0], [80.2, 33.3]],
  uae: [[53.9, 23.9], [56.5, 26.1]],
  thailand: [[97.6, 7.2], [101.6, 20.3]],
};

/** Atlantic Editorial restyle of the OpenMapTiles "positron" basemap. */
function restyle(map: MLMap) {
  const style = map.getStyle() as StyleSpecification;
  for (const layer of style.layers) {
    const id = layer.id;
    const set = (prop: string, value: unknown) => { try { (map.setPaintProperty as (l: string, p: string, v: unknown) => void).call(map, id, prop, value); } catch {} };
    const hide = () => { try { map.setLayoutProperty(id, "visibility", "none"); } catch {} };
    if (layer.type === "background") { set("background-color", "#f4f7fa"); continue; }
    if (layer.type === "fill") {
      if (/water/.test(id)) set("fill-color", "#dee8f4");
      else if (/building/.test(id)) hide();
      else { set("fill-color", "#eef2f6"); set("fill-opacity", 0.55); }
      continue;
    }
    if (layer.type === "line") {
      if (/waterway|river/.test(id)) { set("line-color", "#c9d8e8"); continue; }
      if (/boundary|admin/.test(id)) {
        // The basemap draws OpenStreetMap's de facto international and disputed lines (and
        // administrative lines inside Indian-claimed territory). They are replaced by India's
        // official boundary from the India point-of-view dataset (see addIndiaBorders).
        hide();
        continue;
      }
      if (/rail|minor|path|service|track|pier|aeroway|bridge_|tunnel_/.test(id)) { hide(); continue; }
      if (/highway|road|motorway|trunk|primary/.test(id)) { set("line-color", "#e3e8ee"); continue; }
      continue;
    }
    if (layer.type === "symbol") {
      if (/country|state/.test(id)) {
        try { map.setLayoutProperty(id, "text-field", ["coalesce", ["get", "name:en"], ["get", "name_en"], ["get", "name:latin"], ["get", "name"]]); } catch {}
      }
      if (/country/.test(id)) { set("text-color", "#838177"); set("text-halo-color", "#f4f7fa"); continue; }
      if (/state/.test(id)) { set("text-color", "#a3a198"); set("text-halo-color", "#f4f7fa"); continue; }
      if (/water_name|ocean|sea/.test(id)) { set("text-color", "#8ea6bf"); continue; }
      hide(); // cities/POIs/roads labels: NUAB's own destination labels replace them
    }
  }
}

/**
 * International boundaries as depicted from India's point of view (Natural Earth "POV" data,
 * built by scripts/build-geo.mjs): India is shown with its official boundary.
 */
function addIndiaBorders(map: MLMap) {
  map.addSource("borders-ind", { type: "geojson", data: "/geo/borders-ind.geojson" });
  // beneath the basemap's labels
  const before = (map.getStyle() as StyleSpecification).layers.find((l) => l.type === "symbol")?.id;
  map.addLayer({ id: "india-fill", type: "fill", source: "borders-ind", filter: ["==", ["get", "india"], true], paint: { "fill-color": "#f6f2ea", "fill-opacity": 0.55 } }, before);
  map.addLayer({ id: "borders-other", type: "line", source: "borders-ind", filter: ["!=", ["get", "india"], true], paint: { "line-color": "#838177", "line-width": 0.8, "line-opacity": 0.7 } }, before);
  map.addLayer({ id: "india-border", type: "line", source: "borders-ind", filter: ["==", ["get", "india"], true], paint: { "line-color": "#233a50", "line-width": ["interpolate", ["linear"], ["zoom"], 3, 0.9, 8, 1.8], "line-opacity": 0.85 } }, before);
}

export function MapView({
  dests,
  visibleIds,
  selectedId,
  onSelect,
  line,
  viewRequest,
  onStatus,
}: {
  dests: AtlasDest[];
  visibleIds: Set<string>;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  line: [number, number][];
  viewRequest: { key: ViewKey | "fit"; n: number };
  onStatus: (s: MapStatus) => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const markers = useRef<Map<string, { marker: MLMarker; node: HTMLButtonElement }>>(new Map());
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const visibleRef = useRef(visibleIds);
  visibleRef.current = visibleIds;

  // init
  useEffect(() => {
    let cancelled = false;
    let map: MLMap | null = null;
    let timeout: ReturnType<typeof setTimeout>;
    (async () => {
      try {
        const ml = await import("maplibre-gl");
        if (cancelled || !el.current) return;
        ml.setWorkerUrl("/vendor/maplibre-gl-worker.mjs");
        map = new ml.Map({
          container: el.current,
          style: STYLE_URL,
          bounds: VIEWS.india,
          fitBoundsOptions: { padding: 40 },
          attributionControl: { compact: true },
          cooperativeGestures: false,
          dragRotate: false,
          pitchWithRotate: false,
          maxZoom: 13,
          minZoom: 2,
        });
        mapRef.current = map;
        map.touchZoomRotate.disableRotation();
        map.addControl(new ml.NavigationControl({ showCompass: false }), "bottom-right");
        let loaded = false;
        timeout = setTimeout(() => { if (!loaded) onStatus("failed"); }, 20000);
        map.on("error", (e) => { if (!loaded) { console.warn("map error", e?.error?.message); onStatus("failed"); } });
        map.on("load", () => {
          loaded = true;
          clearTimeout(timeout);
          if (!map) return;
          restyle(map);
          addIndiaBorders(map);
          map.addSource("journey", { type: "geojson", data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: line } } });
          map.addLayer({ id: "journey-line", type: "line", source: "journey", paint: { "line-color": "#233a50", "line-width": 1.4, "line-dasharray": [2, 2], "line-opacity": 0.75 } });

          for (const d of dests) {
            const node = document.createElement("button");
            node.type = "button";
            node.className = "atlas-marker" + (d.featured ? " is-featured" : "") + (d.country === "India" && !d.featured ? " is-minor" : "");
            node.setAttribute("aria-label", `${d.name}, ${d.region}`);
            node.innerHTML = `<span class="atlas-dot"></span><span class="atlas-label">${d.name}</span>`;
            node.addEventListener("click", (e) => { e.stopPropagation(); onSelectRef.current(d.id); });
            const marker = new ml.Marker({ element: node, anchor: "left", offset: [-6, 0] }).setLngLat([d.lng, d.lat]).addTo(map);
            markers.current.set(d.id, { marker, node });
          }
          map.on("click", () => onSelectRef.current(null));
          map.on("zoom", () => updateDensity());
          updateDensity();
          applyVisibility();
          onStatus("ready");
        });
      } catch (err) {
        console.warn("map init failed", err);
        onStatus("failed");
      }
    })();
    const updateDensity = () => {
      const z = map?.getZoom() ?? 5;
      el.current?.setAttribute("data-zoom", z < 6.2 ? "low" : z < 7.8 ? "mid" : "high");
    };
    const markerMap = markers.current;
    return () => {
      cancelled = true;
      clearTimeout(timeout);
      markerMap.forEach(({ marker }) => marker.remove());
      markerMap.clear();
      map?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyVisibility = () => {
    markers.current.forEach(({ node }, id) => {
      const vis = visibleRef.current.has(id);
      node.classList.toggle("is-hidden", !vis);
      node.tabIndex = vis ? 0 : -1;
    });
  };
  useEffect(applyVisibility, [visibleIds]);

  // selection
  useEffect(() => {
    markers.current.forEach(({ node }, id) => {
      node.classList.toggle("is-selected", id === selectedId);
      node.setAttribute("aria-pressed", String(id === selectedId));
    });
    const map = mapRef.current;
    if (!map || !selectedId) return;
    const d = dests.find((x) => x.id === selectedId);
    if (!d) return;
    const wide = (el.current?.clientWidth ?? 0) > 640;
    map.flyTo({ center: [d.lng, d.lat], zoom: Math.max(map.getZoom(), d.country === "India" ? 7 : 8), offset: wide ? [-180, 0] : [0, -120], duration: 1100, essential: true });
  }, [selectedId, dests]);

  // view requests (region buttons, filters, reset)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || viewRequest.n === 0) return;
    if (viewRequest.key === "fit" || viewRequest.key === "all") {
      const pts = dests.filter((d) => visibleRef.current.has(d.id));
      if (!pts.length) return;
      const lngs = pts.map((p) => p.lng), lats = pts.map((p) => p.lat);
      const b: LngLatBoundsLike = [[Math.min(...lngs) - 0.6, Math.min(...lats) - 0.6], [Math.max(...lngs) + 0.6, Math.max(...lats) + 0.6]];
      map.fitBounds(b, { padding: 60, maxZoom: 8, duration: 900 });
    } else {
      map.fitBounds(VIEWS[viewRequest.key], { padding: 40, duration: 900 });
    }
  }, [viewRequest, dests]);

  return (
    <>
      <div className="absolute inset-0">
        {/* maplibre sets position:relative on its container, so the map fills a positioned wrapper */}
        <div ref={el} className="atlas-map h-full w-full" role="region" aria-label="Interactive map of NUAB Tourism destinations" data-zoom="mid" />
      </div>
      <style>{`
        .atlas-marker{display:flex;align-items:center;gap:6px;background:none;border:0;padding:2px;cursor:pointer;color:#233a50}
        .atlas-dot{width:9px;height:9px;border-radius:999px;background:#233a50;box-shadow:0 0 0 2px #fff;flex:none;transition:transform .25s}
        .atlas-marker.is-featured .atlas-dot{width:12px;height:12px;background:#fff;box-shadow:0 0 0 2px #233a50,0 0 0 5px rgba(35,58,80,.12)}
        .atlas-label{font-family:var(--font-dm-mono),monospace;font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;background:rgba(255,255,255,.86);padding:1px 4px;white-space:nowrap;color:#20252b}
        .atlas-marker.is-featured .atlas-label{font-weight:500;color:#233a50}
        .atlas-map[data-zoom="low"] .atlas-marker.is-minor:not(.is-selected) .atlas-label{display:none}
        .atlas-map[data-zoom="mid"] .atlas-marker.is-minor:not(.is-selected):not(:hover):not(:focus-visible) .atlas-label{opacity:0;transition:opacity .2s}
        .atlas-marker:hover .atlas-label,.atlas-marker:focus-visible .atlas-label{display:inline;background:#233a50;color:#fff}
        .atlas-marker.is-selected{z-index:5}
        .atlas-marker.is-selected .atlas-dot{transform:scale(1.5);background:#233a50;box-shadow:0 0 0 2px #fff,0 0 0 6px rgba(35,58,80,.25)}
        .atlas-marker.is-selected .atlas-label{display:inline;background:#233a50;color:#fff}
        .atlas-marker.is-hidden{opacity:0;pointer-events:none}
        .maplibregl-ctrl-top-right{top:6px;right:6px}
      `}</style>
    </>
  );
}
