import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const dashboard = fs.readFileSync(new URL("../src/components/sales/sales-dashboard.tsx", import.meta.url), "utf8");
const dashboardRoute = fs.readFileSync(new URL("../src/app/dashboard/page.tsx", import.meta.url), "utf8");
const permissionsRoute = fs.readFileSync(new URL("../src/app/api/sales/roles/features/route.ts", import.meta.url), "utf8");
const rolePanel = fs.readFileSync(new URL("../src/components/sales/role-permissions-panel.tsx", import.meta.url), "utf8");

test("lead form builder receives the authenticated workspace admin role", () => {
  assert.match(dashboard, /<LeadFormBuilder\s+isAdmin=\{isWorkspaceAdmin\}/);
  assert.doesNotMatch(dashboard, /<LeadFormBuilder\s+isAdmin=\{true\}/);
});

test("closer navigation stays limited to the closer workspace surface", () => {
  assert.match(dashboard, /tabs\.filter\(\(tab\) => \["dashboard", "crm", "grab-leads", "conversations"\]\.includes\(tab\.id\)\)/);
  assert.match(dashboard, /const isCloser = !isWorkspaceAdmin && effectiveWorkspaceRole === "SALES_AGENT"/);
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
