import type { Metadata } from "next";
import Link from "next/link";

import { SalesSignupForm } from "@/components/sales/sales-auth";
import { BrandWordmark } from "@/components/ui/brand-wordmark";

export const metadata: Metadata = {
  title: "Create Sales Workspace | AI Closer CRM",
  description: "Create your dedicated AI Closer sales workspace with automatic SIM call recording and lead pipeline management.",
  robots: { index: false, follow: false },
};

export default function SalesSignupPage() {
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
            <div style={{ marginBottom: "8px", color: "#64748b", fontSize: "0.72rem", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>
              SaaS Sales Workspace
            </div>
            <h1 style={{ fontSize: "1.65rem", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.03em", margin: "0 0 8px" }}>
              Create Your AI Closer Workspace
            </h1>
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
