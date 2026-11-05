import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Matches the live WordPress URLs (every page ends with a trailing slash).
  trailingSlash: true,
  // allows a production build alongside a running dev server (NEXT_DIST_DIR=.next-prod)
  distDir: process.env.NEXT_DIST_DIR || ".next",
  reactStrictMode: true,
  images: {
    // All imagery is pre-sized by scripts/fetch-assets.mjs (WebP srcset), so the
    // optimizer is unnecessary and the site stays static-export compatible.
    unoptimized: true,
  },
  // three.js examples are ESM; transpile keeps the Node build consistent.
  transpilePackages: ["three"],
  // Files in /public are served with `max-age=0` by default, so every visit re-downloads ~2 MB of
  // 3D models and photos. They change rarely: let browsers keep them for 30 days and revalidate in
  // the background after that. (Replacing a file in place? Give it a new name so visitors see it at once.)
  async headers() {
    const cache = [{ key: "Cache-Control", value: "public, max-age=2592000, stale-while-revalidate=604800" }];
    return ["/models/:path*", "/media/:path*", "/brand/:path*", "/geo/:path*", "/favicon.ico"].map((source) => ({ source, headers: cache }));
  },
};

export default nextConfig;
