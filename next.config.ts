import type { NextConfig } from "next";

const rawTarget =
  process.env.AICLOSER_API_URL?.trim() ||
  process.env.NEXT_PUBLIC_AICLOSER_API_URL?.trim() ||
  "https://api.aicloser.in";

const CENTRAL_API_TARGET = rawTarget.replace(/\/api\/v1\/?$/, "").replace(/\/$/, "");

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${CENTRAL_API_TARGET}/api/v1/:path*`,
      },
      {
        source: "/api/sales/:path*",
        destination: `${CENTRAL_API_TARGET}/api/sales/:path*`,
      },
      {
        source: "/api/whatsapp-marketing/:path*",
        destination: `${CENTRAL_API_TARGET}/api/whatsapp-marketing/:path*`,
      },
      {
        source: "/api/auth/:path*",
        destination: "https://app.aicloser.in/api/auth/:path*",
      },
      {
        source: "/api/super-admin/:path*",
        destination: `${CENTRAL_API_TARGET}/api/super-admin/:path*`,
      },
    ];
  },
};

export default nextConfig;
