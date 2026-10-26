import { getDrawing, toPathD } from "./drawings";
import { clsx } from "@/lib/site";

type Props = {
  id: string;
  className?: string;
  /** animate the strokes drawing in (CSS; disabled automatically for reduced motion) */
  draw?: boolean;
  /** total draw duration in seconds */
  duration?: number;
  delay?: number;
  title?: string;
  hatchClassName?: string;
  /** stroke weight multiplier (strokes are in drawing units; 1 ≈ hairline at ~400px wide) */
  weight?: number;
  /** end the viewBox at the drawing's base (no padding below), so the monument can rest flush on an edge */
  ground?: boolean;
  /** SVG preserveAspectRatio, for sizing the drawing inside a box without distortion (e.g. "xMidYMax meet") */
  preserveAspectRatio?: string;
};

/**
 * Fine-line landmark engraving. Pure SVG (server-renderable), drawn with stroke-dashoffset.
 * Uses pathLength=1 so every stroke animates uniformly regardless of its real length.
 */
export function Engraving({ id, className, draw = false, duration = 2.2, delay = 0, title, hatchClassName = "opacity-45", weight = 1, ground = false, preserveAspectRatio }: Props) {
  const d = getDrawing(id);
  const H = d.height;
  // drawings are y-up; their lowest point lands at H − minY in SVG space
  const base = ground ? H - Math.min(...[...d.main, ...d.hatch].flat().map((q) => q[1])) + 0.2 * weight : H + 8;
  // draw from the ground up, like an engraver building the elevation
  const minY = (p: [number, number][]) => Math.min(...p.map((q) => q[1]));
  const main = [...d.main].sort((a, b) => minY(a) - minY(b));
  const hatch = [...d.hatch].sort((a, b) => minY(a) - minY(b));
  const n = main.length;
  return (
    <svg
      viewBox={`-2 -2 104 ${base + 2}`}
      preserveAspectRatio={preserveAspectRatio}
      className={clsx("engrave", className)}
      data-draw={draw ? "" : undefined}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      strokeWidth={0.32 * weight}
    >
      {title && <title>{title}</title>}
      <g className={hatchClassName} strokeWidth={0.2 * weight}>
        {hatch.map((p, i) => (
          <path key={`h${i}`} d={toPathD(p, H)} pathLength={1} style={draw ? ({ "--len": 1, "--dur": `${duration * 0.45}s`, "--delay": `${delay + duration * 0.45 + (i / Math.max(1, hatch.length)) * duration * 0.5}s` } as React.CSSProperties) : undefined} />
        ))}
      </g>
      <g>
        {main.map((p, i) => (
          <path key={`m${i}`} d={toPathD(p, H)} pathLength={1} style={draw ? ({ "--len": 1, "--dur": `${duration * 0.5}s`, "--delay": `${delay + (i / n) * duration * 0.6}s` } as React.CSSProperties) : undefined} />
        ))}
      </g>
    </svg>
  );
}
