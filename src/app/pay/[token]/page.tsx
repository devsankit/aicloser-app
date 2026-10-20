import type { Metadata } from "next";
import { PublicPayGateway } from "@/components/payments/PublicPayGateway";

export const metadata: Metadata = {
  title: "Secure UPI Checkout | AI Closer",
  robots: { index: false, follow: false, noarchive: true },
};

export const dynamic = "force-dynamic";

export default async function PublicPayRoute({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <PublicPayGateway token={token} />;
}
