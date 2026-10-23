import Link from "next/link";
import { Engraving } from "@/components/engraving/Engraving";

export default function NotFound() {
  return (
    <section className="flex min-h-[85svh] items-center bg-mist pt-28">
      <div className="container-x grid items-center gap-12 lg:grid-cols-2">
        <div>
          <p className="coord">00°00′ N · 00°00′ E — OFF THE MAP</p>
          <h1 className="mt-4 text-display-lg">This page isn’t on our atlas.</h1>
          <p className="mt-5 max-w-lg text-lede text-ink/75">The link may be old or mistyped. Every tour, destination and package is still a step away.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/" className="btn btn-primary">Back to the journey</Link>
            <Link href="/destinations/" className="btn btn-ghost">Open the atlas</Link>
            <Link href="/sitemap/" className="btn btn-ghost">Sitemap</Link>
          </div>
        </div>
        <Engraving id="himalaya" draw className="w-full text-navy/70" />
      </div>
    </section>
  );
}
