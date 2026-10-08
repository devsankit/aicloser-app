import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Zap } from "lucide-react";

import { SalesPasswordLoginForm } from "@/components/sales/sales-auth";
import { BrandWordmark } from "@/components/ui/brand-wordmark";
import { getSessionContext } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Sign In | AI Closer CRM",
  description: "Sign in to your AI Closer workspace to manage SIM calls, CRM pipelines, and lead conversions.",
  robots: { index: false, follow: false },
};

function value(input: string | string[] | undefined) {
  return Array.isArray(input) ? input[0] ?? "" : input ?? "";
}

export default async function SalesLoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSessionContext();
  const params = await searchParams;
  if (session.role === "SALES_AGENT" && value(params.preview) !== "1" && value(params.switch) !== "1") {
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
      <div style={{ width: "100%", maxWidth: "460px", display: "flex", flexDirection: "column", gap: "22px" }}>
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
              <Zap size={11} /> AI Closer Workspace
            </div>
            <h1 style={{ fontSize: "1.65rem", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.03em", margin: "0 0 8px" }}>
              Sign in to AI Closer
            </h1>
            <p style={{ fontSize: "13.5px", color: "#475569", lineHeight: 1.55, margin: 0 }}>
              Access your SIM calling telemetry, audio recordings, drag-and-drop CRM pipelines, and multi-channel inbox.
            </p>
          </div>

          <SalesPasswordLoginForm
            clientType={value(params.clientType)}
            error={value(params.error)}
            identifier={value(params.identifier)}
            message={value(params.message)}
            redirectTo={value(params.redirectTo) || "/"}
          />

          <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "16px", textAlign: "center" }}>
            <p style={{ margin: 0, fontSize: "13px", color: "#64748b" }}>
              Don&apos;t have a workspace yet?{" "}
              <Link
                href="/signup"
                style={{
                  color: "#ff6b2f",
                  fontWeight: 700,
                  textDecoration: "none",
                }}
              >
                Create Workspace →
              </Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
