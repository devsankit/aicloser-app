import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A dev server keeps .next busy; set NEXT_DIST_DIR to build into another
  // folder (used to verify a production build without stopping `next dev`).
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
