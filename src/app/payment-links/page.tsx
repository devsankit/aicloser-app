import type { Metadata } from "next";

import { UpiPaymentCollectionPanel } from "@/components/sales/upi-payment-collection-panel";
import { getSessionContext } from "@/lib/auth/session";
import { requirePageRole } from "@/lib/auth/page-guard";

export const metadata: Metadata = { title: "UPI Payment Collection | AIcloser", robots: { index: false, follow: false, noarchive: true } };
export const dynamic = "force-dynamic";

export default async function PaymentLinksPage() {
  await requirePageRole(["SALES_AGENT", "MANAGER", "ADMIN"], "/payment-links");
  const session = await getSessionContext();
  return <UpiPaymentCollectionPanel sessionRole={session.role as "SALES_AGENT" | "MANAGER" | "ADMIN" | "SUPER_ADMIN"} tenantId={session.tenantId || "tenant-gigxomi"} />;
}
