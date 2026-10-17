import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SalesDashboard } from "@/components/sales/sales-dashboard";
import { requirePageRole } from "@/lib/auth/page-guard";
import { getSessionContext } from "@/lib/auth/session";
import { compactSalesSnapshotForInitialRender, getSalesAgentAccess, getSalesSnapshotForRole, trackSalesReferralEvent } from "@/lib/gigxomi/sales-store";
import { getRolePermissionsMatrix } from "@/lib/gigxomi/role-permissions-store";
import { listSalesWhatsAppFlowRuns, listSalesWhatsAppFlows } from "@/lib/gigxomi/sales-whatsapp-flow-store";
import { buildInstagramMetaSetupUrls } from "@/lib/meta/instagram-routes";
import { getSalesWhatsAppChannelView } from "@/lib/whatsapp-marketing/sales-channel-view";
import { getInstagramConnectionView } from "@/lib/meta/instagram-connection-view";

export const metadata: Metadata = {
  title: "Sales CRM Dashboard | AIcloser",
  robots: { index: false, follow: false },
};

export default async function DashboardPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = searchParams ? await searchParams : undefined;
  const query = new URLSearchParams();
  if (params) {
    for (const [key, val] of Object.entries(params)) {
      if (Array.isArray(val)) {
        for (const v of val) query.append(key, v);
      } else if (typeof val === "string") {
        query.set(key, val);
      }
    }
  }
  if (!query.has("tab")) {
    query.set("tab", "dashboard");
  }
  redirect(`/?${query.toString()}`);
}
