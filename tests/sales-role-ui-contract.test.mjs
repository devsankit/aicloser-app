import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const dashboard = fs.readFileSync(new URL("../src/components/sales/sales-dashboard.tsx", import.meta.url), "utf8");
const dashboardRoute = fs.readFileSync(new URL("../src/app/dashboard/page.tsx", import.meta.url), "utf8");
const permissionsRoute = fs.readFileSync(new URL("../src/app/api/sales/roles/features/route.ts", import.meta.url), "utf8");
const rolePanel = fs.readFileSync(new URL("../src/components/sales/role-permissions-panel.tsx", import.meta.url), "utf8");
const leadNotes = fs.readFileSync(new URL("../src/components/sales/lead-notes-manager.tsx", import.meta.url), "utf8");
const globalStyles = fs.readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");

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

test("Plugins & Channels opens WhatsApp and Instagram setup panels in place", () => {
  const pluginsHub = fs.readFileSync(new URL("../src/components/sales/plugins-hub.tsx", import.meta.url), "utf8");
  assert.match(dashboard, /whatsAppCloudPanel=\{/);
  assert.match(dashboard, /instagramPluginPanel=\{/);
  assert.match(pluginsHub, /scrollIntoView\(\{ behavior: "smooth", block: "start" \}\)/);
  assert.match(pluginsHub, /WhatsApp bulk marketing onboarding/);
  assert.match(pluginsHub, /Connect WABA → register the phone → subscribe the webhook/);
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
