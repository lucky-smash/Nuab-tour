import type { Metadata } from "next";
import { IntlLandingPage } from "@/components/intl/IntlPages";
import { intlLandings } from "@/data";

export const metadata: Metadata = {
  title: intlLandings.thailand.seoTitle ?? "Thailand Packages",
  description: intlLandings.thailand.metaDescription,
  alternates: { canonical: "/thailand-package/" },
};
export default function Page() {
  return <IntlLandingPage country="thailand" />;
}
