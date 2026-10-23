import { blogPosts, cabPages, carTours, busTours, multiDayTours, intlPackages } from "@/data";
import { destinations } from "@/data/destinations";

export type RouteGroup = { title: string; items: { label: string; path: string }[] };

/** Every public route, grouped — feeds /sitemap/ (HTML) and /sitemap.xml. */
export function routeGroups(): RouteGroup[] {
  return [
    {
      title: "Pages",
      items: [
        { label: "Home", path: "/" },
        { label: "About", path: "/about/" },
        { label: "Contact Us", path: "/contact-us/" },
        { label: "Tours & fares", path: "/tours/" },
        { label: "Destinations", path: "/destinations/" },
        { label: "Blogs", path: "/blogs/" },
        { label: "Gallery", path: "/gallery/" },
        { label: "Equipment & Safety Gear", path: "/equipment-safety-gear/" },
        { label: "Privacy Policy", path: "/privacy-policy/" },
        { label: "Sitemap", path: "/sitemap/" },
      ],
    },
    { title: "Same-day tours by car", items: carTours.map((t) => ({ label: t.title, path: t.path })) },
    { title: "Same-day tours by bus", items: busTours.map((t) => ({ label: t.title, path: t.path })) },
    { title: "Golden Triangle & multi-day", items: multiDayTours.map((t) => ({ label: t.title, path: t.path })) },
    { title: "Outstation cabs", items: cabPages.map((c) => ({ label: c.title, path: c.path })) },
    {
      title: "Dubai packages",
      items: [{ label: "Dubai Package", path: "/dubai-package/" }, { label: "Dubai (country archive)", path: "/country/dubai/" }, ...intlPackages.filter((p) => p.country === "dubai").map((p) => ({ label: p.title, path: p.path }))],
    },
    {
      title: "Thailand packages",
      items: [{ label: "Thailand Package", path: "/thailand-package/" }, { label: "Thailand (country archive)", path: "/country/thailand/" }, ...intlPackages.filter((p) => p.country === "thailand").map((p) => ({ label: p.title, path: p.path }))],
    },
    { title: "Destinations", items: destinations.map((d) => ({ label: d.name, path: `/destinations/${d.id}/` })) },
    { title: "Blog", items: blogPosts.map((p) => ({ label: p.title, path: p.path })) },
  ];
}
