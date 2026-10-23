import type { MetadataRoute } from "next";
import { routeGroups } from "@/lib/routes";
import { SITE } from "@/lib/site";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const seen = new Set<string>();
  return routeGroups()
    .flatMap((g) => g.items)
    .filter((it) => (seen.has(it.path) ? false : (seen.add(it.path), true)))
    .map((it) => ({
      url: SITE.url + it.path,
      changeFrequency: it.path === "/" ? "weekly" : "monthly",
      priority: it.path === "/" ? 1 : /tour|package|cabs/.test(it.path) ? 0.8 : 0.6,
    }));
}
