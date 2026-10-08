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
  const operationsTenantId = effectiveTenantId;
  const salesFlowScopeId = access.agent.id;
  const roleMatrix = await getRolePermissionsMatrix();
  const configuredWorkspaceRole = String((access.agent.permissions as Record<string, unknown> | null | undefined)?.workspaceRole ?? "").toUpperCase();
  const permissionsRole = session.role === "ADMIN" || session.role === "SUPER_ADMIN"
    ? session.role
    : configuredWorkspaceRole === "MANAGER" || configuredWorkspaceRole === "SALES_AGENT"
      ? configuredWorkspaceRole
      : "SALES_AGENT";
  const [snapshot, whatsAppConnection, chatbotFlows, chatbotRuns] = await Promise.all([
    getSalesSnapshotForRole({ userId: session.userId ?? "", role: session.role, tenantId: effectiveTenantId }),
    getSalesWhatsAppChannelView(operationsTenantId),
    listSalesWhatsAppFlows(salesFlowScopeId),
    listSalesWhatsAppFlowRuns(salesFlowScopeId),
  ]);

  return (
    <SalesDashboard
      salesOperations={JSON.parse(
        JSON.stringify({
          tenantId: operationsTenantId,
          whatsAppConnection,
          whatsAppTenantOptions: [],
          instagramConnection: null,
          instagramSetupUrls: buildInstagramMetaSetupUrls(operationsTenantId),
          chatbotFlows,
          chatbotRuns,
          chatbotAgencies: [],
        }),
      )}
      snapshot={JSON.parse(JSON.stringify(compactSalesSnapshotForInitialRender(snapshot)))}
      canManageContacts={session.role === "ADMIN" || session.role === "SUPER_ADMIN"}
      sessionRole={session.role}
      rolePermissions={roleMatrix[permissionsRole]}
    />
  );
}
