import { clsx } from "@/lib/site";

/**
 * NUAB Tourism logo: the client's original artwork (nuabtourism.in), on a transparent background so it
 * sits on the sky, the white nav and the navy footer alike. `inverted` (navy footer) keeps NUAB red and
 * turns TOURISM and the division line white, which the original blue cannot hold on navy.
 */
export function Wordmark({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- 252×125 PNG, no resizing to gain from next/image
    <img
      src={inverted ? "/brand/nuab-tourism-logo-light.png" : "/brand/nuab-tourism-logo.png"}
      alt="NUAB Tourism — a division of NUAB Enterprises Pvt. Ltd."
      width={252}
      height={125}
      decoding="async"
      className={clsx("block h-[46px] w-auto select-none", className)}
      draggable={false}
    />
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
