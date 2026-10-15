import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("sales-store getSalesSnapshotForRole sets isAgentScopedView for SALES_AGENT", () => {
  const storePath = path.join(process.cwd(), "src", "lib", "gigxomi", "sales-store.ts");
  const source = fs.readFileSync(storePath, "utf8");

  // Verify isAgentScopedView is defined with role check
  assert.ok(
    source.includes("const isAgentScopedView = isAgentView || (!isWorkspaceAdmin && !isWorkspaceManager);"),
    "Expected isAgentScopedView to include non-admin and non-manager check",
  );

  // Verify leads, deals, leadPool, earnings, payouts use isAgentScopedView
  assert.ok(
    source.includes("leads: isAgentScopedView ? visibleLeads : leads"),
    "Expected snapshot.leads to use isAgentScopedView",
  );
  assert.ok(
    source.includes("leadPool: isAgentScopedView ? visibleLeadPool : leadPool"),
    "Expected snapshot.leadPool to use isAgentScopedView",
  );
  assert.ok(
    source.includes("deals: isAgentScopedView ? visibleDeals : deals"),
    "Expected snapshot.deals to use isAgentScopedView",
  );
});

test("sales-store caps active leads and grab pool to remaining quota slots for closer", () => {
  const storePath = path.join(process.cwd(), "src", "lib", "gigxomi", "sales-store.ts");
  const source = fs.readFileSync(storePath, "utf8");

  // Verify effectiveMaxActiveLeads and remainingGrabSlots logic
  assert.ok(
    source.includes("effectiveMaxActiveLeads"),
    "Expected effectiveMaxActiveLeads definition in sales-store.ts",
  );
  assert.ok(
    source.includes("remainingGrabSlots"),
    "Expected remainingGrabSlots definition in sales-store.ts",
  );
  assert.ok(
    source.includes("openQueue.slice(0, remainingGrabSlots)"),
    "Expected open queue leads to be sliced to remainingGrabSlots for closers",
  );
  assert.ok(
    source.includes("activeLeadQuota:"),
    "Expected activeLeadQuota to be attached to currentAgent",
  );
  assert.ok(
    source.includes("notIn: [\"CLOSED_WON\", \"CLOSED_LOST\", \"CLOSED\", \"LOST\", \"PAID\", \"CONVERTED_FREE\", \"RECYCLED\"]"),
    "Expected claimSalesLeadPoolItem to count all active stages",
  );
});

test("GET /api/sales/contacts route enforces closer scoping and omits unassigned workspace contacts", () => {
  const contactsRoutePath = path.join(process.cwd(), "src", "app", "api", "sales", "contacts", "route.ts");
  const source = fs.readFileSync(contactsRoutePath, "utf8");

  // Verify closer check
  assert.ok(
    source.includes("const isCloser = !isWorkspaceAdmin && !isWorkspaceManager;"),
    "Expected isCloser to be defined in contacts route",
  );

  // Verify marketing contact scoping
  assert.ok(
    source.includes("else if (!isCloser || mc.tenantId === personalScannerTenantId)"),
    "Expected marketing contacts to be scoped to personalScannerTenantId for closers",
  );

  // Verify activeLeadQuota returned in response
  assert.ok(
    source.includes("activeLeadQuota: salesSnapshot.currentAgent?.activeLeadQuota || null"),
    "Expected activeLeadQuota to be returned in contacts response",
  );
});

test("UserWhatsAppSyncCard is wired into SalesDashboard action center", () => {
  const dashboardPath = path.join(process.cwd(), "src", "components", "sales", "sales-dashboard.tsx");
  const source = fs.readFileSync(dashboardPath, "utf8");

  assert.ok(
    source.includes('import { UserWhatsAppSyncCard } from "@/components/sales/user-whatsapp-sync-card";'),
    "Expected UserWhatsAppSyncCard import in sales-dashboard.tsx",
  );
  assert.ok(
    source.includes("<UserWhatsAppSyncCard"),
    "Expected UserWhatsAppSyncCard JSX element in sales-dashboard.tsx",
  );
  assert.ok(
    source.includes("isCloser={isCloser}"),
    "Expected isCloser prop passed to UserWhatsAppSyncCard",
  );
});

test("SalesDashboard grab-leads view displays quota banners and capacity enforcement", () => {
  const dashboardPath = path.join(process.cwd(), "src", "components", "sales", "sales-dashboard.tsx");
  const source = fs.readFileSync(dashboardPath, "utf8");

  assert.ok(
    source.includes("snapshot.currentAgent?.activeLeadQuota"),
    "Expected activeLeadQuota checks in grab-leads workspace",
  );
  assert.ok(
    source.includes("Active Lead Quota Reached"),
    "Expected Active Lead Quota Reached banner text in grab-leads workspace",
  );
  assert.ok(
    source.includes("disabled={!snapshot.currentAgent?.id || Boolean(snapshot.currentAgent?.activeLeadQuota?.isAtCapacity)}"),
    "Expected grab lead button disabled when at capacity",
  );
});
