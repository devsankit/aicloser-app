import { redirect } from "next/navigation";

import { getSessionContext } from "@/lib/auth/session";
import { getWorkspacePaymentState } from "@/lib/billing/workspace-access";

export const metadata = {
  title: "Activate your AIcloser plan",
  robots: { index: false, follow: false },
};

export default async function ActivatePlanPage() {
  const session = await getSessionContext();
  if (!session.userId || session.role === "GUEST") redirect("/login");
  const paymentState = await getWorkspacePaymentState(session.userId);
  if (!paymentState.locked) redirect("/");

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "24px", background: "#f8fafc" }}>
      <section style={{ width: "min(100%, 560px)", border: "1px solid #e2e8f0", borderRadius: "20px", background: "#ffffff", padding: "36px", textAlign: "center", boxShadow: "0 20px 60px rgba(15, 23, 42, 0.08)" }}>
        <div style={{ width: "52px", height: "52px", margin: "0 auto 18px", borderRadius: "16px", display: "grid", placeItems: "center", background: "#fff7ed", color: "#ea580c", fontSize: "26px" }}>!</div>
        <h1 style={{ margin: 0, color: "#0f172a", fontSize: "1.55rem" }}>Activate your plan</h1>
        <p style={{ margin: "14px auto 0", maxWidth: "420px", color: "#475569", lineHeight: 1.6 }}>
          Your payment is still pending. To activate your plan, connect with our team.
        </p>
        <a href="tel:+919589510954" style={{ display: "inline-flex", marginTop: "22px", minHeight: "46px", alignItems: "center", justifyContent: "center", padding: "0 20px", borderRadius: "10px", background: "#ea580c", color: "#ffffff", textDecoration: "none", fontWeight: 700 }}>
          Connect with team: +91 95895 10954
        </a>
      </section>
    </main>
  );
}
