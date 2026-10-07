import type { NextConfig } from "next";

const noIndexHeaders = [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }];

const nextConfig: NextConfig = {
  serverExternalPackages: ["@whiskeysockets/baileys", "pino", "qrcode"],
  turbopack: {},
  // The local dashboard is opened through either loopback hostname. Next's
  // dev server otherwise blocks its client chunks when the browser uses the
  // alternate hostname, leaving the server-rendered page but no hydration.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "gigxomi.com" },
      { protocol: "https", hostname: "www.gigxomi.com" },
      { protocol: "https", hostname: "img.youtube.com" },
      { protocol: "https", hostname: "i.ytimg.com" },
    ],
  },
  async redirects() {
    return [
      { source: "/sales", destination: "/", permanent: true },
      { source: "/sales/login", destination: "/login", permanent: true },
      { source: "/sales/signup", destination: "/signup", permanent: true },
    ];
  },
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,POST,PUT,PATCH,DELETE,OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Authorization, Content-Type" },
        ],
      },
      { source: "/:path*", headers: noIndexHeaders },
      {
        source: "/:path*",
        headers: [{ key: "Permissions-Policy", value: "microphone=(self), camera=(self)" }],
      },
    ];
  },
};

export default nextConfig;
