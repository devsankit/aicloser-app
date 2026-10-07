import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Shield, Smartphone, Sparkles } from "lucide-react";

import { SalesSignupForm } from "@/components/sales/sales-auth";
import { BrandWordmark } from "@/components/ui/brand-wordmark";
import { getSessionContext } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Create Sales Workspace | AI Closer CRM",
  description: "Create your dedicated AI Closer sales workspace with automatic SIM call recording and lead pipeline management.",
  robots: { index: false, follow: false },
};

export default async function SalesSignupPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSessionContext();
  const params = searchParams ? await searchParams : {};
  const preview = Array.isArray(params.preview) ? params.preview[0] : params.preview;
  if ((session.role === "SALES_AGENT" || session.role === "ADMIN") && preview !== "1") {
    redirect("/");
  }

  return (
    <main
      className="sales-auth-shell sales-auth-light"
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "28px 16px",
        background: "radial-gradient(circle at 50% 0%, rgba(255, 107, 47, 0.09), transparent 42rem), #f8fafc",
        color: "#0f172a",
      }}
    >
      <div style={{ width: "100%", maxWidth: "510px", display: "flex", flexDirection: "column", gap: "22px" }}>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <BrandWordmark ariaLabel="AI Closer CRM Home" href="/" />
        </div>

        <section
          className="sales-auth-card"
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            boxShadow: "0 20px 50px rgba(15, 23, 42, 0.08), 0 1px 3px rgba(15, 23, 42, 0.04)",
            borderRadius: "20px",
            padding: "34px 30px",
            display: "flex",
            flexDirection: "column",
            gap: "20px",
            color: "#0f172a",
          }}
        >
          <div>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "11px",
                fontWeight: 800,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#ff6b2f",
                background: "rgba(255, 107, 47, 0.1)",
                border: "1px solid rgba(255, 107, 47, 0.25)",
                padding: "4px 10px",
                borderRadius: "999px",
                marginBottom: "12px",
              }}
            >
              <Sparkles size={11} /> 14-Day Free Trial
            </div>
            <div style={{ marginBottom: "8px", color: "#64748b", fontSize: "0.72rem", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>
              SaaS Sales Workspace
            </div>
            <h1 style={{ fontSize: "1.65rem", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.03em", margin: "0 0 8px" }}>
              Create Your AI Closer Workspace
            </h1>
            <p style={{ fontSize: "13.5px", color: "#475569", lineHeight: 1.55, margin: 0 }}>
              Launch your isolated sales CRM with 1-click Android SIM dialer, automatic call recording, role-based access controls, and WhatsApp pipelines.
            </p>
            <p style={{ margin: "10px 0 0", color: "#64748b", fontSize: "0.76rem", fontWeight: 700 }}>
              Zero cross-workspace data merge.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "8px",
              padding: "11px 12px",
              background: "#f8fafc",
              borderRadius: "12px",
              border: "1px solid #e2e8f0",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11.5px", fontWeight: 600, color: "#334155" }}>
              <Smartphone size={14} style={{ color: "#ff6b2f", flexShrink: 0 }} /> Native SIM Calling
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11.5px", fontWeight: 600, color: "#334155" }}>
              <Shield size={14} style={{ color: "#0284c7", flexShrink: 0 }} /> Multi-Role Matrix
            </div>
          </div>

          <SalesSignupForm />

          <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "16px", textAlign: "center" }}>
            <p style={{ margin: 0, fontSize: "13px", color: "#64748b" }}>
              Already have a workspace?{" "}
              <Link
                href="/login"
                style={{
                  color: "#ff6b2f",
                  fontWeight: 700,
                  textDecoration: "none",
                }}
              >
                Sign in →
              </Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
