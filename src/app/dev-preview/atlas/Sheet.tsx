"use client";
import { useEffect, useRef } from "react";
import { atlasTexture } from "@/components/journey/Environment";

/** Dev-only: shows the engraved atlas sheet texture used on the 3D ground. */
export default function Sheet() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    document.fonts.ready.then(() => {
      const t = atlasTexture(4);
      const c = t.image as HTMLCanvasElement;
      c.style.width = "100%";
      ref.current?.replaceChildren(c);
      document.title = "ready";
    });
  }, []);
  return <div ref={ref} className="mx-auto max-w-5xl pt-28" />;
}
