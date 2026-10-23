import type { Metadata } from "next";
import { IntlLandingPage } from "@/components/intl/IntlPages";
import { intlLandings } from "@/data";

export const metadata: Metadata = {
  title: intlLandings.dubai.seoTitle ?? "Dubai Packages",
  description: intlLandings.dubai.metaDescription,
  alternates: { canonical: "/dubai-package/" },
};
export default function Page() {
  return <IntlLandingPage country="dubai" />;
}
