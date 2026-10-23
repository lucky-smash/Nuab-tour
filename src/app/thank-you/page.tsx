import type { Metadata } from "next";
import Link from "next/link";
import { thankYou } from "@/data";
import { Engraving } from "@/components/engraving/Engraving";

export const metadata: Metadata = {
  title: "Thank You — Enquiry Received",
  description: thankYou.metaDescription,
  robots: { index: false },
};

export default function ThankYouPage() {
  return (
    <section className="flex min-h-[80svh] items-center bg-mist pt-28">
      <div className="container-x max-w-2xl text-center">
        <Engraving id="taj-mahal" draw className="mx-auto w-72 text-navy" />
        <h1 className="mt-10 text-display-lg">Thank you.</h1>
        <p className="mx-auto mt-5 max-w-lg text-lede text-ink/75">{thankYou.text?.replace(/ or connect with us on social media for more updates/, "")}</p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href="/" className="btn btn-primary">Back to the journey</Link>
          <Link href="/tours/" className="btn btn-ghost">Browse tours</Link>
        </div>
      </div>
    </section>
  );
}
