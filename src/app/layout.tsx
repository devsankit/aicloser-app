import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { AppProvider } from "@/lib/store";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://app.aicloser.in"),
  title: {
    default: "AIcloser — Dedicated SIM-based AI Sales CRM",
    template: "%s | AIcloser",
  },
  description:
    "AIcloser is a dedicated SIM-based AI sales & telecalling CRM: pipeline, contacts, calls, and automations in one calm workspace.",
  applicationName: "AIcloser",
  robots: { index: false, follow: false },
  icons: {
    icon: [{ url: "/aicloser-favicon.svg", type: "image/svg+xml" }],
    shortcut: "/aicloser-favicon.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#191919" },
  ],
};

// Runs before first paint so the saved theme and accent never flash.
const themeBootstrap = `
(function () {
  var KEY = 'closer.ui.v2';
  function hex(value) {
    var m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(value || '').trim());
    if (!m) return null;
    var r = m[1];
    if (r.length === 3) r = r.charAt(0) + r.charAt(0) + r.charAt(1) + r.charAt(1) + r.charAt(2) + r.charAt(2);
    var n = parseInt(r, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  function out(c) {
    function p(v) { v = Math.max(0, Math.min(255, Math.round(v))); return (v < 16 ? '0' : '') + v.toString(16); }
    return '#' + p(c.r) + p(c.g) + p(c.b);
  }
  function blend(c, target, amount) {
    return { r: c.r + (target - c.r) * amount, g: c.g + (target - c.g) * amount, b: c.b + (target - c.b) * amount };
  }
  function rgba(c, a) {
    return 'rgba(' + Math.round(c.r) + ', ' + Math.round(c.g) + ', ' + Math.round(c.b) + ', ' + a + ')';
  }
  function chan(v) { var s = v / 255; return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); }
  function lum(c) { return 0.2126 * chan(c.r) + 0.7152 * chan(c.g) + 0.0722 * chan(c.b); }
  function darkenForWhite(c, target) {
    var out = c;
    for (var amount = 0; amount <= 0.92; amount += 0.04) {
      out = { r: c.r * (1 - amount), g: c.g * (1 - amount), b: c.b * (1 - amount) };
      if (1.05 / (lum(out) + 0.05) >= target) break;
    }
    return out;
  }
  function contrast(a, b) {
    var l1 = lum(a), l2 = lum(b);
    var hi = Math.max(l1, l2), lo = Math.min(l1, l2);
    return (hi + 0.05) / (lo + 0.05);
  }
  function liftForDark(c, target) {
    var start = c, out = c;
    for (var amount = 0; amount <= 0.9; amount += 0.02) {
      out = { r: start.r + (255 - start.r) * amount, g: start.g + (255 - start.g) * amount, b: start.b + (255 - start.b) * amount };
      var bg = { r: 15 + (out.r - 15) * 0.18, g: 16 + (out.g - 16) * 0.18, b: 17 + (out.b - 17) * 0.18 };
      if (contrast(out, bg) >= (target || 4.6)) break;
    }
    return out;
  }
  function darkenForLight(c, target) {
    var start = c, out = c;
    for (var amount = 0; amount <= 0.9; amount += 0.02) {
      out = { r: start.r * (1 - amount), g: start.g * (1 - amount), b: start.b * (1 - amount) };
      var bg = { r: 255 + (out.r - 255) * 0.12, g: 255 + (out.g - 255) * 0.12, b: 255 + (out.b - 255) * 0.12 };
      if (contrast(out, bg) >= (target || 4.6)) break;
    }
    return out;
  }
  var SCALES = { sm: 0.92, md: 1, lg: 1.1, xl: 1.22 };
  var SIZES = { caption: 12, meta: 13, body: 14, title: 16, page: 19, metric: 24 };
  try {
    var saved = JSON.parse(localStorage.getItem(KEY) || '{}');
    var theme = saved.theme === 'light' ? 'light' : 'dark';
    var density = saved.density === 'compact' ? 'compact' : 'comfortable';
    var light = theme === 'light';
    var root = document.documentElement;
    root.dataset.theme = theme;
    root.dataset.density = density;
    if (saved.sidebarWidth) root.style.setProperty('--sidebar-w', saved.sidebarWidth + 'px');
    if (saved.colWidth) root.style.setProperty('--col-w', saved.colWidth + 'px');
    if (saved.drawerWidth) root.style.setProperty('--drawer-w', saved.drawerWidth + 'px');
    var accent = hex(saved.accent) || hex('#f4612a');
    var base = light ? darkenForLight(blend(accent, 0, 0.3), 4.9) : liftForDark(accent, 4.8);
    var strong = darkenForWhite(base, 4.7);
    var strongHover = blend(strong, 0, 0.09);
    root.style.setProperty('--accent', out(base));
    root.style.setProperty('--accent-hover', out(light ? blend(base, 0, 0.12) : blend(base, 255, 0.16)));
    root.style.setProperty('--accent-strong', out(strong));
    root.style.setProperty('--accent-strong-hover', out(strongHover));
    root.style.setProperty('--accent-soft', rgba(base, light ? 0.12 : 0.18));
    root.style.setProperty('--accent-border', rgba(base, light ? 0.38 : 0.45));
    root.style.setProperty('--bg-selected', rgba(base, light ? 0.12 : 0.16));
    root.style.setProperty('--info', out(base));
    root.style.setProperty('--info-soft', rgba(base, light ? 0.1 : 0.15));
    var factor = SCALES[saved.fontScale] || 1;
    for (var name in SIZES) {
      root.style.setProperty('--fs-' + name, Math.round(SIZES[name] * factor) + 'px');
    }
  } catch (e) {
    document.documentElement.dataset.theme = 'dark';
  }
})();
`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="dark" data-density="comfortable" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body>
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  );
}
