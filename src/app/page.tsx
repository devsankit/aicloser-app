import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SalesDashboard } from "@/components/sales/sales-dashboard";
import { requirePageRole } from "@/lib/auth/page-guard";
import { getSessionContext } from "@/lib/auth/session";
import { buildSalesWhatsAppTenantId } from "@/lib/api/resolve-session-tenant";
import { ensureWhatsAppConnectionDraftFromFile, getInstagramConnectionStateFromFile, warmPlatformSnapshotCache } from "@/lib/gigxomi/dummy-platform-file-store";
import { compactSalesSnapshotForInitialRender, getSalesAgentAccess, getSalesSnapshotForRole, trackSalesReferralEvent } from "@/lib/gigxomi/sales-store";
import { listSalesWhatsAppFlowRuns, listSalesWhatsAppFlows } from "@/lib/gigxomi/sales-whatsapp-flow-store";
import { buildInstagramMetaSetupUrls } from "@/lib/meta/instagram-routes";

export const metadata: Metadata = {
  title: "Sales Dashboard",
  robots: { index: false, follow: false },
};

export default async function SalesPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = searchParams ? await searchParams : undefined;
  const rawRef = params?.ref;
  const ref = Array.isArray(rawRef) ? rawRef[0] : rawRef;
  if (ref) {
    try {
      await trackSalesReferralEvent({
        code: ref,
        eventType: "PRICING_VIEW",
        path: "/",
        metadata: { target: "website" },
      });
    } catch {
      // non-blocking for referral tracking
    }
  }

  await requirePageRole(["SALES_AGENT", "ADMIN", "MANAGER"], "/");
  const session = await getSessionContext();
  const access = await getSalesAgentAccess(session.userId);
  if (!access.ok) {
    redirect(`/login?error=${encodeURIComponent(access.reason === "PENDING" ? "Your sales account is waiting for approval." : access.reason === "SUSPENDED" ? "Your sales account is suspended. Contact support." : "Create or login with an approved sales account.")}`);
  }
  const effectiveTenantId =
    session.tenantId?.trim() ||
    access.agent.tenantId ||
    "tenant-gigxomi";
  const operationsTenantId =
    effectiveTenantId !== "tenant-gigxomi"
      ? effectiveTenantId
      : buildSalesWhatsAppTenantId(session.userId ?? "");
  const salesFlowScopeId = access.agent.id;
  const companyName =
    access.agent.permissions && typeof access.agent.permissions === "object" && "companyName" in (access.agent.permissions as Record<string, unknown>)
      ? String((access.agent.permissions as Record<string, unknown>).companyName || "GXclosers")
      : "GXclosers";
  const [snapshot, whatsAppConnection, instagramConnection, chatbotFlows, chatbotRuns] = await Promise.all([
    getSalesSnapshotForRole({ userId: session.userId ?? "", role: session.role, tenantId: effectiveTenantId }),
    ensureWhatsAppConnectionDraftFromFile({
      tenantId: operationsTenantId,
      businessName: companyName,
      displayName: access.agent.displayName || companyName,
    }),
    getInstagramConnectionStateFromFile(operationsTenantId),
    listSalesWhatsAppFlows(salesFlowScopeId),
    listSalesWhatsAppFlowRuns(salesFlowScopeId),
  ]);
  const instagramStatus =
    instagramConnection?.status === "Connected" || instagramConnection?.status === "Needs attention"
      ? instagramConnection.status
      : instagramConnection?.pluginEnabled === true
        ? "Needs attention"
        : "Not connected";

  return (
    <SalesDashboard
      salesOperations={JSON.parse(
        JSON.stringify({
          tenantId: operationsTenantId,
          whatsAppConnection,
          whatsAppTenantOptions: [],
          instagramConnection: instagramConnection
            ? {
                tenantId: instagramConnection.tenantId,
                pluginEnabled: instagramConnection.pluginEnabled === true,
                status: instagramStatus,
                appId: "",
                accountId: instagramConnection.accountId ?? "",
                username: instagramConnection.username,
                accountType: instagramConnection.accountType ?? "",
                connectedAt: instagramConnection.connectedAt,
                setupUrls: buildInstagramMetaSetupUrls(operationsTenantId),
              }
            : null,
          chatbotFlows,
          chatbotRuns,
        }),
      )}
      snapshot={JSON.parse(JSON.stringify(compactSalesSnapshotForInitialRender(snapshot)))}
      canManageContacts={session.role === "ADMIN" || session.role === "SUPER_ADMIN"}
      sessionRole={session.role}
    />
  );
}
