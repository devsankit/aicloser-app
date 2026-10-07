import type { Metadata } from "next";
import Link from "next/link";
import { BrandWordmark } from "@/components/ui/brand-wordmark";

export const metadata: Metadata = {
  title: "Access Restricted | AIcloser",
  robots: { index: false, follow: false },
};

export default function UnauthorizedPage() {
  return (
    <main className="sales-auth-shell">
      <section className="sales-auth-card">
        <BrandWordmark />
        <div>
          <p className="section-label">Access Restricted</p>
          <h1>Sales Agent permissions required.</h1>
          <p>
            Your current account does not have Closer or Sales Agent permissions for AIcloser.
            Please sign in with an authorized sales account or create a new workspace.
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", width: "100%", marginTop: "1rem" }}>
          <Link
            href="/login"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0.75rem 1.25rem",
              backgroundColor: "var(--closer-orange, #ff6b2f)",
              color: "#ffffff",
              fontWeight: 700,
              borderRadius: "0.5rem",
              textDecoration: "none",
              textAlign: "center",
            }}
          >
            Sign in to AIcloser &rarr;
          </Link>
          <Link
            href="/signup"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0.75rem 1.25rem",
              backgroundColor: "var(--color-surface-soft, #1f2937)",
              color: "var(--color-text-primary, #f3f4f6)",
              border: "1px solid var(--color-border, rgba(255, 255, 255, 0.1))",
              fontWeight: 600,
              borderRadius: "0.5rem",
              textDecoration: "none",
              textAlign: "center",
            }}
          >
            Create New Closer Account
          </Link>
        </div>
      </section>
    </main>
  );
}