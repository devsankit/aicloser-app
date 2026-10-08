import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const signupRoute = fs.readFileSync(new URL("../src/app/api/sales/auth/signup/route.ts", import.meta.url), "utf8");
const salesStore = fs.readFileSync(new URL("../src/lib/gigxomi/sales-store.ts", import.meta.url), "utf8");
const conversationAccess = fs.readFileSync(new URL("../src/lib/api/conversation-access.ts", import.meta.url), "utf8");
const conversationViewResponse = fs.readFileSync(new URL("../src/lib/api/conversation-view-response.ts", import.meta.url), "utf8");
const resolveSessionTenant = fs.readFileSync(new URL("../src/lib/api/resolve-session-tenant.ts", import.meta.url), "utf8");
const requireSessionRole = fs.readFileSync(new URL("../src/lib/api/require-session-role.ts", import.meta.url), "utf8");
const teamRoute = fs.readFileSync(new URL("../src/app/api/sales/team/route.ts", import.meta.url), "utf8");
const leadsRoute = fs.readFileSync(new URL("../src/app/api/sales/leads/route.ts", import.meta.url), "utf8");
const signupPage = fs.readFileSync(new URL("../src/app/signup/page.tsx", import.meta.url), "utf8");
const salesAuthForm = fs.readFileSync(new URL("../src/components/sales/sales-auth.tsx", import.meta.url), "utf8");
const mainPage = fs.readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");

test("SaaS signup provisions isolated workspace and sends the user to login", () => {
  assert.match(signupRoute, /provisionSaaSCloserWorkspace/);
  assert.match(signupRoute, /redirectTo:\s*"\/login"/);
  assert.doesNotMatch(signupRoute, /applySessionCookie/);
  assert.match(signupRoute, /companyName/);
  assert.match(salesAuthForm, /companyName/);
  assert.match(salesAuthForm, /Create Sales Workspace/);
  assert.match(signupPage, /SaaS Sales Workspace/);
  assert.doesNotMatch(signupPage, /Zero cross-workspace data merge/);
});

test("provisionSaaSCloserWorkspace creates dedicated tenant, group, and active workspace admin profile", () => {
  assert.match(salesStore, /export async function provisionSaaSCloserWorkspace/);
  assert.match(salesStore, /const tenantId = `tenant-\${baseSlug}-\${tenantSuffix}`/);
  assert.match(salesStore, /const groupId = `group-\${tenantId}`/);
  assert.match(salesStore, /transaction\.salesAgentGroup\.create/);
  assert.match(salesStore, /status:\s*"ACTIVE"/);
  assert.match(salesStore, /canCreateSubAgents:\s*true/);
  assert.match(salesStore, /workspaceAdmin:\s*true/);
});

test("getSalesSnapshotForRole enforces strict tenant filtering across all entities", () => {
  assert.match(salesStore, /session\.tenantId\?\.trim\(\)/);
  assert.match(salesStore, /where:\s*isSuperAdminAll\s*\?\s*undefined\s*:\s*\{\s*agent:\s*\{\s*user:\s*\{\s*tenantId:\s*effectiveTenantId/);
  assert.match(salesStore, /where:\s*isSuperAdminAll\s*\?\s*undefined\s*:\s*\{\s*assignedAgent:\s*\{\s*user:\s*\{\s*tenantId:\s*effectiveTenantId/);
  assert.match(salesStore, /mobileDevicesRaw\s*\.filter\(\(device\)\s*=>\s*isWorkspaceAdmin/);
  assert.match(salesStore, /mobileCallsRaw\s*\.filter\(\(call\)\s*=>\s*isWorkspaceAdmin/);
});

test("syncConversationLeadsIntoSales maintains isolated per-tenant locks and scoped ingestion", () => {
  assert.match(salesStore, /const tenantSyncPromises = new Map<string, Promise<void>>\(\)/);
  assert.match(salesStore, /const tenantSyncTimes = new Map<string, number>\(\)/);
  assert.match(salesStore, /where:\s*conversationTenantFilter/);
  assert.match(salesStore, /assignedAgent:\s*\{\s*user:\s*\{\s*tenantId:\s*effectiveTenantId/);
});

test("stage updates and conversation linking isolate by assigned agent tenantId", () => {
  assert.match(salesStore, /targetTenantId = lead\.assignedAgent\?\.user\?\.tenantId \|\| "tenant-gigxomi"/);
  assert.match(salesStore, /targetTenantId === "tenant-gigxomi"/);
});

test("subagents inherit tenantId from workspace creator", () => {
  assert.match(salesStore, /targetTenantId = input\.tenantId\?\.trim\(\) \|\| null/);
  assert.match(teamRoute, /tenantId:\s*authorization\.session\.tenantId/);
  assert.match(teamRoute, /status:\s*isWorkspaceAdmin \? "ACTIVE" : "PENDING"/);
});

test("chat and conversation access strictly isolates SALES_AGENT to own tenantId", () => {
  assert.match(conversationAccess, /const effectiveSessionTenant = session\.tenantId\?\.trim\(\) \|\| "tenant-gigxomi"/);
  assert.match(conversationAccess, /conversation\.tenantId === effectiveSessionTenant/);
  assert.match(conversationViewResponse, /const effectiveSessionTenant = session\.tenantId\?\.trim\(\) \|\| "tenant-gigxomi"/);
  assert.match(conversationViewResponse, /conversation\.tenantId === effectiveSessionTenant/);
});

test("resolveWhatsAppSetupTenantId preserves custom SaaS tenantId", () => {
  assert.match(resolveSessionTenant, /rawTenant && rawTenant !== "tenant-gigxomi"/);
  assert.match(resolveSessionTenant, /return rawTenant/);
});

test("role and route authorization allow workspace ADMIN alongside SALES_AGENT", () => {
  assert.match(requireSessionRole, /allowedRoles\.includes\("SALES_AGENT"\) && session\.role === "ADMIN"/);
  assert.match(mainPage, /requirePageRole\(\["SALES_AGENT", "ADMIN", "MANAGER"\], "\/"\)/);
  assert.match(leadsRoute, /snapshot\.visibleAgents\.some\(\(a\) => a\.id === assignedAgentId\)/);
});
