import type { Metadata } from "next";

import { getPublicUpiPaymentLink } from "@/lib/upi-payment-collection";
import { PublicUpiPaymentPage } from "@/components/sales/public-upi-payment-page";

export const metadata: Metadata = {
  title: "Secure UPI Payment | AIcloser",
  robots: { index: false, follow: false, noarchive: true },
};

export const dynamic = "force-dynamic";

export default async function PublicUpiPaymentRoute({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const paymentLink = await getPublicUpiPaymentLink(token);
  if (!paymentLink) {
    return <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "#0c0d10", color: "#f5f7fb" }}><section style={{ maxWidth: 500, textAlign: "center" }}><h1>Payment link unavailable</h1><p style={{ color: "#aab1c1" }}>This payment link is invalid, expired, or no longer accepting payments.</p></section></main>;
  }
  return <PublicUpiPaymentPage paymentLink={paymentLink} />;
}
