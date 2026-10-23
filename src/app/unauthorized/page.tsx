import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";

export const metadata: Metadata = {
  title: "Access Restricted | AI Closer",
  robots: { index: false, follow: false },
};

export default function UnauthorizedPage() {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <div
            className="auth-brand-badge"
            style={{
              background: "var(--warning-soft, rgba(234, 179, 8, 0.15))",
              color: "var(--warning, #eab308)",
              border: "1px solid var(--warning, #eab308)",
              margin: "0 auto 14px auto",
            }}
          >
            <Icon name="shield" size={24} />
          </div>
          <span className="chip" data-tone="warning" style={{ margin: "0 auto 10px auto" }}>
            <span className="dot" /> Access Restricted
          </span>
          <h1 className="auth-title">Permission Required</h1>
          <p className="auth-subtitle">
            Your current account role does not have authorization to view this section.
            Please return to your active CRM workspace or switch to an authorized account.
          </p>
        </div>

        <div className="auth-form">
          <Link
            href="/dashboard"
            className="btn"
            data-variant="primary"
            data-size="md"
            style={{ width: "100%", justifyContent: "center" }}
          >
            <Icon name="home" size={15} /> Back to CRM Dashboard
          </Link>
          <Link
            href="/login"
            className="btn"
            data-variant="ghost"
            data-size="md"
            style={{ width: "100%", justifyContent: "center" }}
          >
            <Icon name="arrow-right" size={15} /> Sign in with Admin Account
          </Link>
        </div>

        <div style={{ textAlign: "center", borderTop: "1px solid var(--border)", paddingTop: 14 }}>
          <p style={{ fontSize: "var(--fs-caption, 12px)", color: "var(--text-tertiary)" }}>
            Need access? Contact your workspace owner to update your closer permissions.
          </p>
        </div>
      </div>
    </div>
  );
}