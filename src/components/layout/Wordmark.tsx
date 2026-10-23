import { clsx } from "@/lib/site";

/** NUAB Tourism wordmark: an engraved compass-meridian mark + editorial lettering. */
export function Wordmark({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  return (
    <span className={clsx("flex items-center gap-3", className)}>
      <CompassMark className={clsx("size-9 shrink-0", inverted ? "text-white" : "text-navy")} />
      <span className="flex flex-col leading-none">
        <span className={clsx("font-display text-[1.45rem] tracking-[0.02em]", inverted ? "text-white" : "text-navy")} style={{ fontVariationSettings: '"opsz" 72, "SOFT" 0', fontWeight: 500 }}>
          NUAB
        </span>
        <span className={clsx("mt-1 font-mono text-[0.58rem] tracking-[0.42em]", inverted ? "text-white/70" : "text-stone")}>TOURISM</span>
      </span>
    </span>
  );
}

export function CompassMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden fill="none" stroke="currentColor" strokeWidth="1">
      <circle cx="20" cy="20" r="18.5" />
      <circle cx="20" cy="20" r="14" strokeOpacity=".45" />
      {Array.from({ length: 24 }, (_, i) => {
        const a = (i / 24) * Math.PI * 2;
        const r1 = i % 6 === 0 ? 14 : 16.5;
        const r = (n: number) => Math.round(n * 100) / 100; // avoid server/client float drift
        return <line key={i} x1={r(20 + Math.cos(a) * r1)} y1={r(20 + Math.sin(a) * r1)} x2={r(20 + Math.cos(a) * 18.5)} y2={r(20 + Math.sin(a) * 18.5)} strokeOpacity=".7" />;
      })}
      {/* meridian route + aircraft-like needle */}
      <path d="M20 4.5 L23.2 20 L20 35.5 L16.8 20 Z" fill="currentColor" stroke="none" />
      <path d="M8 26 C 14 14, 26 26, 32 14" strokeDasharray="1.6 1.6" />
      <circle cx="20" cy="20" r="1.6" fill="#fff" stroke="currentColor" />
    </svg>
  );
}
