import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const signupRoute = fs.readFileSync(new URL("../src/app/api/sales/auth/signup/route.ts", import.meta.url), "utf8");
const salesStore = fs.readFileSync(new URL("../src/lib/gigxomi/sales-store.ts", import.meta.url), "utf8");
const authStore = fs.readFileSync(new URL("../src/lib/auth/store.ts", import.meta.url), "utf8");
const conversationAccess = fs.readFileSync(new URL("../src/lib/api/conversation-access.ts", import.meta.url), "utf8");
const conversationViewResponse = fs.readFileSync(new URL("../src/lib/api/conversation-view-response.ts", import.meta.url), "utf8");
const resolveSessionTenant = fs.readFileSync(new URL("../src/lib/api/resolve-session-tenant.ts", import.meta.url), "utf8");
const requireSessionRole = fs.readFileSync(new URL("../src/lib/api/require-session-role.ts", import.meta.url), "utf8");
const teamRoute = fs.readFileSync(new URL("../src/app/api/sales/team/route.ts", import.meta.url), "utf8");
const leadsRoute = fs.readFileSync(new URL("../src/app/api/sales/leads/route.ts", import.meta.url), "utf8");
const signupPage = fs.readFileSync(new URL("../src/app/signup/page.tsx", import.meta.url), "utf8");
const salesAuthForm = fs.readFileSync(new URL("../src/components/sales/sales-auth.tsx", import.meta.url), "utf8");
const mainPage = fs.readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
const googleSignupRoute = fs.readFileSync(new URL("../src/app/api/sales/auth/google/signup/route.ts", import.meta.url), "utf8");
const paymentAccess = fs.readFileSync(new URL("../src/lib/billing/workspace-access.ts", import.meta.url), "utf8");
const pageGuard = fs.readFileSync(new URL("../src/lib/auth/page-guard.ts", import.meta.url), "utf8");
const superAdminUsersRoute = fs.readFileSync(new URL("../src/app/api/super-admin/users/route.ts", import.meta.url), "utf8");
const clientSessions = fs.readFileSync(new URL("../src/lib/auth/client-sessions.ts", import.meta.url), "utf8");
const revokeAllSessionsRoute = fs.readFileSync(new URL("../src/app/api/auth/client-sessions/revoke-all/route.ts", import.meta.url), "utf8");
const superAdminUsersUiRoute = fs.readFileSync(new URL("../src/app/api/super-admin/users/route.ts", import.meta.url), "utf8");

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
  assert.match(salesStore, /INSERT INTO \"AicloserWorkspace\"/);
  assert.match(salesStore, /ON CONFLICT \(\"id\"\) DO NOTHING/);
  assert.match(salesStore, /SELECT \"id\"\s+FROM \"AicloserWorkspace\"/);
  assert.ok(
    salesStore.indexOf('INSERT INTO "AicloserWorkspace"') < salesStore.indexOf('transaction.salesAgentGroup.create'),
    "AicloserWorkspace must be created before tenant-scoped records"
  );
  assert.match(salesStore, /maxWait:\s*10000,\s*timeout:\s*30000/);
  assert.match(salesStore, /transaction\.salesAgentGroup\.create/);
  assert.match(salesStore, /status:\s*"ACTIVE"/);
  assert.match(salesStore, /canCreateSubAgents:\s*true/);
  assert.match(salesStore, /workspaceAdmin:\s*true/);
  assert.match(salesStore, /"maxSeats"/);
  assert.match(salesStore, /\$\{seats\}, '\{\}'::jsonb/);
  assert.match(salesStore, /seatLimit:\s*seats/);
  assert.match(salesStore, /transaction\.userSubscription\.create/);
});

test("normal and Google signup accept the requested number of users", () => {
  assert.match(signupRoute, /const seats = Number\(body\.seats \?\? 5\)/);
  assert.match(googleSignupRoute, /const seats = Number\(body\.seats \?\? 5\)/);
  assert.match(salesAuthForm, /Number of users \/ team seats/);
  assert.match(salesAuthForm, /name="seats"/);
});

test("pending payment locks workspace access after the 24-hour grace period", () => {
  assert.match(paymentAccess, /WORKSPACE_PAYMENT_GRACE_MS = 24 \* 60 \* 60 \* 1000/);
  assert.match(paymentAccess, /paymentStatus !== "PENDING"/);
  assert.match(pageGuard, /getWorkspacePaymentState/);
  assert.match(pageGuard, /redirect\("\/activate-plan"\)/);
  assert.match(superAdminUsersRoute, /Tenant users, seats, status, and payments are managed by the Tenant Admin/);
  assert.match(superAdminUsersRoute, /status: 403/);
});

test("super-admin login exposes safe session recovery actions", () => {
  assert.match(salesAuthForm, /loginScope: "super-admin"/);
  assert.match(salesAuthForm, /forceReplace: forceReplace \? "1" : "0"/);
  assert.match(salesAuthForm, /Login here/);
  assert.match(salesAuthForm, /Logout all sessions/);
  assert.match(salesAuthForm, /\/api\/auth\/client-sessions\/revoke-all/);
  assert.match(clientSessions, /export async function revokeAllActiveAppClientSessions/);
  assert.match(revokeAllSessionsRoute, /user\.role !== "SUPER_ADMIN"/);
  assert.match(revokeAllSessionsRoute, /revokeAllActiveAppClientSessions/);
});

test("super-admin platform view does not expose tenant user or seat mutation controls", () => {
  assert.match(salesAuthForm, /Login here/);
  const superAdminPlatformView = fs.readFileSync(new URL("../src/components/super-admin/super-admin-platform-overview.tsx", import.meta.url), "utf8");
  assert.match(superAdminUsersUiRoute, /getSuperAdminPlatformSummary/);
  assert.match(superAdminUsersUiRoute, /Tenant users, seats, status, and payments are managed by the Tenant Admin/);
  assert.match(superAdminUsersUiRoute, /status: 403/);
  assert.match(superAdminPlatformView, /Tenant summaries/);
  assert.match(superAdminPlatformView, /Package/);
  assert.match(superAdminPlatformView, /Active/);
  assert.match(superAdminPlatformView, /Pending/);
  assert.match(superAdminPlatformView, /Suspended/);
  assert.doesNotMatch(superAdminPlatformView, /Add New User|Login as User|Update seats/);
});

test("production bootstrap does not recreate legacy demo users after a clean purge", () => {
  assert.match(authStore, /Production signup must remain usable after a clean workspace purge/);
  assert.match(authStore, /process\.env\.NODE_ENV === \"production\" && !ENABLE_DEMO_AUTH_SEED/);
  assert.ok(
    authStore.indexOf('process.env.NODE_ENV === "production" && !ENABLE_DEMO_AUTH_SEED') < authStore.indexOf("upsertMetaReviewTestUsers"),
    "production bootstrap must exit before legacy demo-user seeding"
  );
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
