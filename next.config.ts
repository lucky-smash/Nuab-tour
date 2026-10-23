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
};

export default nextConfig;
