import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://app.aicloser.in"),
  title: {
    default: "AIcloser — Dedicated SIM-based AI Sales CRM",
    template: "%s | AIcloser",
  },
  description: "AIcloser — Dedicated SIM-based AI Telecalling and Sales CRM SaaS.",
  applicationName: "AIcloser",
  robots: { index: false, follow: false },
  icons: {
    icon: [{ url: "/aicloser-favicon.svg", type: "image/svg+xml" }],
    shortcut: "/aicloser-favicon.svg",
    apple: [
      {
        url: "/apple-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  interactiveWidget: "resizes-content",
  viewportFit: "cover",
};

import { ImpersonationBanner } from "@/components/super-admin/impersonation-banner";
import { ClientSessionHeartbeat } from "@/components/auth/client-session-heartbeat";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="icon" href="/aicloser-favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-icon.png" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&family=Space+Grotesk:wght@300..700&display=swap"
          rel="stylesheet"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var saved = localStorage.getItem('ai-closer-theme');
                  var theme = saved === 'light' || saved === 'dark' ? saved : 'dark';
                  document.documentElement.setAttribute('data-theme', theme);
                  document.documentElement.classList.add(theme);
                } catch (e) {
                  document.documentElement.setAttribute('data-theme', 'dark');
                  document.documentElement.classList.add('dark');
                }
              })();
            `,
          }}
        />
      </head>
      <body suppressHydrationWarning>
        <ClientSessionHeartbeat />
        <ImpersonationBanner />
        {children}
      </body>
    </html>
  );
}
