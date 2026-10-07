import { NextResponse } from "next/server";

import { trackSalesReferralEvent } from "@/lib/gigxomi/sales-store";

const PLAY_STORE_BASE_URL = "https://play.google.com/store/apps/details?id=com.gigxomi.app";
const PLAY_STORE_MARKET_URL = "market://details?id=com.gigxomi.app";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ref = searchParams.get("ref")?.trim() || "";
  const userAgent = request.headers.get("user-agent") || "";
  const isAndroid = /android/i.test(userAgent);

  if (ref) {
    try {
      await trackSalesReferralEvent({
        code: ref,
        eventType: "PRICING_VIEW",
        path: "/go/app",
        metadata: {
          target: "android_app",
          isAndroid,
          referrer: request.headers.get("referer") || undefined,
          userAgent,
        },
      });
    } catch {
      // Non-blocking for redirection
    }
  }

  const referrerParam = ref
    ? `utm_source=referral&utm_medium=android_app&utm_campaign=${encodeURIComponent(ref)}`
    : "utm_source=referral&utm_medium=android_app";

  const targetWebUrl = `${PLAY_STORE_BASE_URL}&referrer=${encodeURIComponent(referrerParam)}`;
  const targetMarketUrl = `${PLAY_STORE_MARKET_URL}&referrer=${encodeURIComponent(referrerParam)}`;

  if (isAndroid) {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Opening Gigxomi on Google Play...</title>
  <meta http-equiv="refresh" content="2;url=${targetWebUrl}">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    body { background: #0A0D0B; color: #F5F7FA; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 24px; text-align: center; }
    .card { background: rgba(20, 25, 17, 0.95); border: 1px solid rgba(215, 255, 47, 0.2); border-radius: 16px; padding: 32px 24px; max-width: 420px; width: 100%; box-shadow: 0 20px 50px rgba(0,0,0,0.6); }
    .logo { width: 56px; height: 56px; margin: 0 auto 16px; border-radius: 12px; background: rgba(215, 255, 47, 0.1); border: 1px solid rgba(215, 255, 47, 0.3); display: flex; align-items: center; justify-content: center; font-size: 24px; }
    h1 { font-size: 1.25rem; font-weight: 700; margin-bottom: 8px; color: #F5F7FA; }
    p { font-size: 0.9rem; color: #A8AEA2; margin-bottom: 24px; line-height: 1.5; }
    .btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; width: 100%; padding: 14px 20px; background: #D7FF2F; color: #000; font-weight: 700; font-size: 1rem; border-radius: 10px; text-decoration: none; transition: transform 0.15s, background 0.15s; margin-bottom: 12px; }
    .btn:active { transform: scale(0.98); }
    .alt-link { display: block; font-size: 0.85rem; color: #737B70; text-decoration: underline; margin-top: 8px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ff6b2f" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg></div>
    <h1>Opening Gigxomi App...</h1>
    <p>Redirecting you directly to the official Google Play Store app listing.</p>
    <a href="${targetMarketUrl}" class="btn" id="market-btn">
      <span>Open in Google Play</span>
    </a>
    <a href="${targetWebUrl}" class="alt-link">Open in browser instead</a>
  </div>
  <script>
    (function() {
      try {
        window.location.href = "${targetMarketUrl}";
      } catch (e) {}

      setTimeout(function() {
        if (!document.hidden) {
          window.location.href = "${targetWebUrl}";
        }
      }, 1800);
    })();
  </script>
</body>
</html>`;

    const response = new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    });

    if (ref) {
      response.cookies.set("gx_ref", ref, {
        path: "/",
        maxAge: 30 * 24 * 60 * 60,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });
    }

    return response;
  }

  const response = NextResponse.redirect(targetWebUrl, 302);
  if (ref) {
    response.cookies.set("gx_ref", ref, {
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }
  return response;
}
