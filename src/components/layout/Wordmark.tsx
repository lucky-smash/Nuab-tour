import { clsx } from "@/lib/site";

/**
 * NUAB Tourism logo: the client's original artwork (nuabtourism.in) — the round NT badge (as in its
 * search listing) beside the NUAB / TOURISM lettering, both on transparent backgrounds so they sit on the
 * sky, the white nav and the navy footer alike. `inverted` (navy footer) keeps NUAB red and turns TOURISM
 * and the division line white, which the original blue cannot hold on navy.
 */
export function Wordmark({ className, inverted = false, size = "md" }: { className?: string; inverted?: boolean; size?: "md" | "lg" }) {
  const lg = size === "lg";
  return (
    <span className={clsx("flex items-center", lg ? "gap-3.5" : "gap-2.5", className)}>
      <span
        className={clsx(
          "grid shrink-0 place-items-center rounded-full bg-white",
          lg ? "size-[58px]" : "size-[42px]",
          inverted ? "shadow-[0_2px_10px_rgb(0_0_0/0.25)]" : "ring-1 ring-line shadow-[0_2px_8px_rgb(35_58_80/0.12)]",
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- small brand PNGs, nothing for next/image to gain */}
        <img src="/brand/nuab-icon.png" alt="" width={512} height={512} decoding="async" className="w-[74%] select-none" draggable={false} />
      </span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={inverted ? "/brand/nuab-tourism-logo-light.png" : "/brand/nuab-tourism-logo.png"}
        alt="NUAB Tourism — a division of NUAB Enterprises Pvt. Ltd."
        width={252}
        height={125}
        decoding="async"
        className={clsx("block w-auto select-none", lg ? "h-16" : "h-[46px]")}
        draggable={false}
      />
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
