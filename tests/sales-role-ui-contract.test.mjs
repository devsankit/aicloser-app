import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const dashboard = fs.readFileSync(new URL("../src/components/sales/sales-dashboard.tsx", import.meta.url), "utf8");
const dashboardRoute = fs.readFileSync(new URL("../src/app/dashboard/page.tsx", import.meta.url), "utf8");
const permissionsRoute = fs.readFileSync(new URL("../src/app/api/sales/roles/features/route.ts", import.meta.url), "utf8");
const rolePanel = fs.readFileSync(new URL("../src/components/sales/role-permissions-panel.tsx", import.meta.url), "utf8");
const leadNotes = fs.readFileSync(new URL("../src/components/sales/lead-notes-manager.tsx", import.meta.url), "utf8");
const globalStyles = fs.readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
const campaignsStore = fs.readFileSync(new URL("../src/lib/gigxomi/calling-campaigns-store.ts", import.meta.url), "utf8");
const campaignsRoute = fs.readFileSync(new URL("../src/app/api/sales/campaigns/route.ts", import.meta.url), "utf8");
const callReportsRoute = fs.readFileSync(new URL("../src/app/api/sales/call-reports/route.ts", import.meta.url), "utf8");

test("lead form builder receives the authenticated workspace admin role", () => {
  assert.match(dashboard, /<LeadFormBuilder\s+isAdmin=\{isWorkspaceAdmin\}/);
  assert.doesNotMatch(dashboard, /<LeadFormBuilder\s+isAdmin=\{true\}/);
});

test("closer navigation stays limited to the closer workspace surface", () => {
  assert.match(dashboard, /tabs\.filter\(\(tab\) => \["dashboard", "crm", "grab-leads", "conversations"\]\.includes\(tab\.id\)\)/);
  assert.match(dashboard, /const isCloser = !isWorkspaceAdmin && effectiveWorkspaceRole === "SALES_AGENT"/);
});

test("admin navigation does not expose the closer-only grab leads queue", () => {
  assert.match(dashboard, /isWorkspaceAdmin\s*\n\s*\? tabs\.filter\(\(tab\) => tab\.id !== "grab-leads"\)/);
  assert.match(dashboard, /const canUseGrabLeads = roundRobinAccess\.enabled && Boolean\(currentAgent\?\.canClaimLeads\)/);
});

test("admin dashboard keeps calling as reporting, not an admin dialer action", () => {
  assert.match(dashboard, /isWorkspaceAdmin && section === "calls" \? "reports" : section/);
  assert.match(dashboard, /<BarChart3 size=\{16\} \/> Open Team Report/);
  assert.match(dashboard, /isCloser \? \([\s\S]*?Grab next lead[\s\S]*?\) : isWorkspaceAdmin \? \([\s\S]*?Open Team Report[\s\S]*?\) : \(/);
});

test("admin dashboard is a team reporting view and excludes admin-owned work", () => {
  assert.match(dashboard, /function isAdminSalesAgent\(agent/);
  assert.match(dashboard, /const reportingAgents = useMemo\(\(\) =>/);
  assert.match(dashboard, /snapshot\.visibleAgents\.filter\(\(agent\) => agent\.status === "ACTIVE"[\s\S]*?isAdminSalesAgent\(agent\)/);
  assert.match(dashboard, /const dashboardLeads = useMemo\(/);
  assert.match(dashboard, /reportingAgentIds\.has\(lead\.assignedAgentId\)/);
  assert.match(dashboard, /Team performance &amp; ownership/);
  assert.match(dashboard, /Admin accounts are excluded/);
  assert.match(dashboard, /Review Team Calls &amp; Audio/);
});

test("Plugins & Channels routes channel setup to existing settings", () => {
  const pluginsHub = fs.readFileSync(new URL("../src/components/sales/plugins-hub.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(dashboard, /whatsAppCloudPanel=\{/);
  assert.doesNotMatch(dashboard, /instagramPluginPanel=\{/);
  assert.match(pluginsHub, /onOpenPluginSettings\?\.\(\)/);
  assert.match(dashboard, /setSettingsHubView\("channels"\)/);
  assert.match(dashboard, /navigateSales\("profile"\)/);
  assert.match(dashboard, /<AdminWhatsAppSetupPanel/);
  assert.match(dashboard, /<SuperAdminInstagramPluginCard/);
});

test("WhatsApp setup cannot remain in an indefinite loading state", () => {
  const whatsapp = fs.readFileSync(new URL("../src/components/admin/admin-dummy-controls.tsx", import.meta.url), "utf8");
  assert.match(whatsapp, /new AbortController\(\)/);
  assert.match(whatsapp, /setTimeout\(\(\) => controller\.abort\(\), 10_000\)/);
  assert.match(whatsapp, /WhatsApp setup unavailable/);
  assert.match(whatsapp, /Retry loading/);
  assert.match(whatsapp, /setConnectionLoadKey\(\(value\) => value \+ 1\)/);
});

test("internal sidebar reserves space for its footer instead of covering the last menu item", () => {
  assert.match(globalStyles, /\.internal-theme-root \.internal-sidebar\s*\{[\s\S]*?grid-template-rows:\s*auto minmax\(0, 1fr\) auto;/);
});

test("the direct dashboard route accepts the manager workspace role", () => {
  assert.match(dashboardRoute, /requirePageRole\(\["SALES_AGENT", "ADMIN", "MANAGER"\]/);
});

test("open dashboards refresh role permissions without blocking CRM refresh", () => {
  assert.match(dashboard, /fetch\("\/api\/sales\/roles\/features", \{ cache: "no-store" \}\)/);
  assert.match(dashboard, /setLiveRolePermissions\(permissionsPayload\.userPermissions/);
  assert.match(dashboard, /setInterval\(syncPermissions, 30_000\)/);
  assert.match(dashboard, /Permission refresh is best-effort and must not block CRM data refresh/);
});

test("permission refresh resolves the configured workspace role", () => {
  assert.match(permissionsRoute, /const configuredWorkspaceRole = String\(\(access\?\.agent\?\.permissions/);
  assert.match(permissionsRoute, /const effectiveRole = auth\.session\.role === "ADMIN" \|\| auth\.session\.role === "SUPER_ADMIN"/);
  assert.match(permissionsRoute, /userPermissions: matrix\[effectiveRole as keyof RolePermissionsMatrix\]/);
});

test("manager visibility follows the effective workspace role", () => {
  assert.match(dashboard, /const canViewTeamData = isWorkspaceAdmin \|\| effectiveWorkspaceRole === "MANAGER"/);
});

test("full seat plans explain and prevent blocked user creation", () => {
  assert.match(rolePanel, /const seatsExhausted = Boolean\(/);
  assert.match(rolePanel, /All \{workspacePlan\?\.plan\.seatLimit \?\? 0\} active seats are in use/);
  assert.match(rolePanel, /disabled=\{creatingUser \|\| seatsExhausted\}/);
  assert.match(rolePanel, /role=\{userNotice\.type === "error" \? "alert" : "status"\}/);
});

test("CRM recording states use one user-facing status label", () => {
  assert.match(dashboard, /function recordingStatusLabel\(value: string \| null \| undefined\)/);
  assert.match(dashboard, /call \? recordingStatusLabel\(call\.recordingStatus\) : "No recording"/);
  assert.match(dashboard, /\{recordingStatusLabel\(call\.recordingStatus\)\}/);
  assert.match(dashboard, /\{recordingStatusLabel\(c\.recordingStatus\)\}/);
});

test("disabled lead actions explain the prerequisite", () => {
  assert.match(dashboard, /Add note \(enter text first\)/);
  assert.match(dashboard, /Save follow-up \(choose a date first\)/);
  assert.match(leadNotes, /Add note \(enter text first\)/);
});

test("calling campaigns contain only tenant-scoped live data", () => {
  assert.doesNotMatch(campaignsStore, /DEFAULT_CAMPAIGNS|cmp-march-inbound|cmp-cold-outreach|Q1 Agency Inbound|E-Commerce Founders/);
  assert.match(campaignsStore, /tenantId: string;/);
  assert.match(campaignsStore, /function campaignsFileForTenant\(tenantId: string\)/);
  assert.match(campaignsStore, /export async function getCallingCampaigns\(tenantId: string\)/);
  assert.match(campaignsStore, /return \[\];/);
  assert.match(campaignsStore, /where: \{ tenantId, customerPhone: \{ not: null \} \}/);
  assert.match(campaignsRoute, /resolveSessionTenantId\(auth\.session/);
  assert.match(campaignsRoute, /getCallingCampaigns\(tenantId\)/);
  assert.match(campaignsRoute, /upsertCallingCampaign\(\{ \.\.\.body, tenantId \}\)/);
  assert.match(dashboard, /CallReportsPanel/);
  assert.doesNotMatch(dashboard, /Power Dialer & SIM Recordings Hub|Missed Queue & IVR|CallingCampaignsPanel|MissedCallsQueue/);
  assert.match(dashboard, /Call Reports & Recordings/);
  assert.match(dashboard, /api\/sales\/call-reports/);
  assert.match(dashboard, /Incoming calls/);
  assert.match(dashboard, /Outgoing calls/);
  assert.match(dashboard, /Missed calls/);
  assert.match(dashboard, /Talk time/);
  assert.match(dashboard, /Recordings/);
  assert.match(callReportsRoute, /requireSessionRole\(\["SUPER_ADMIN", "ADMIN", "MANAGER", "SALES_AGENT"\]\)/);
  assert.match(callReportsRoute, /resolveSessionTenantId\(auth\.session/);
  assert.match(callReportsRoute, /user: \{ tenantId \}/);
  assert.match(callReportsRoute, /visibleAgentIds/);
  assert.match(callReportsRoute, /recordingStatus: "UPLOADED"/);
});

test("call reporting has no placeholder call data", () => {
  const missedCallsStore = fs.readFileSync(new URL("../src/lib/gigxomi/missed-calls-store.ts", import.meta.url), "utf8");
  const advancedReportsStore = fs.readFileSync(new URL("../src/lib/gigxomi/advanced-reports-store.ts", import.meta.url), "utf8");
  assert.doesNotMatch(missedCallsStore, /DEFAULT_MISSED_CALLS|mc-101|Vikram Malhotra|Aman Gupta/);
  assert.doesNotMatch(advancedReportsStore, /demoData|1240|2890/);
});
