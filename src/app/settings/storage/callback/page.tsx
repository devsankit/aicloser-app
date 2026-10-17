"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { aicloserApi } from "@/lib/api-client";

function GoogleDriveCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("Finishing Google Drive connection…");

  useEffect(() => {
    const code = searchParams.get("code");
    const oauthError = searchParams.get("error");
    if (oauthError) {
      router.replace(`/?tab=profile&googleDrive=error&message=${encodeURIComponent(oauthError)}`);
      return;
    }
    if (!code) {
      router.replace("/?tab=profile&googleDrive=error&message=Missing%20Google%20authorization%20code");
      return;
    }

    let cancelled = false;
    void aicloserApi.integrations.googleDrive
      .handleCallback(code, `${window.location.origin}/settings/storage/callback`)
      .then(() => {
        if (!cancelled) router.replace("/?tab=profile&googleDrive=connected");
      })
      .catch((error: any) => {
        if (!cancelled) {
          setMessage(error?.message || "Google Drive connection failed.");
          window.setTimeout(() => router.replace("/?tab=profile&googleDrive=error"), 1200);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "var(--color-bg, #f8fafc)", color: "var(--color-text-primary, #0f172a)" }}>
      <section style={{ width: "min(460px, 100%)", padding: 28, borderRadius: 18, border: "1px solid var(--color-border, #dbe2ea)", background: "var(--color-surface-elevated, #fff)", textAlign: "center", boxShadow: "0 18px 50px rgba(15, 23, 42, 0.08)" }}>
        <div style={{ width: 48, height: 48, margin: "0 auto 14px", borderRadius: 14, display: "grid", placeItems: "center", background: "rgba(255, 107, 47, 0.12)", color: "#ff6b2f", fontSize: 24 }}>☁</div>
        <h1 style={{ margin: "0 0 8px", fontSize: 20 }}>Google Drive setup</h1>
        <p style={{ margin: 0, color: "var(--color-text-secondary, #64748b)", fontSize: 14 }}>{message}</p>
      </section>
    </main>
  );
}

export default function GoogleDriveCallbackPage() {
  return (
    <Suspense fallback={<main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>Finishing Google Drive connection…</main>}>
      <GoogleDriveCallbackContent />
    </Suspense>
  );
}
