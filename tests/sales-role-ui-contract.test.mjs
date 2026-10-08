import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const dashboard = fs.readFileSync(new URL("../src/components/sales/sales-dashboard.tsx", import.meta.url), "utf8");
const dashboardRoute = fs.readFileSync(new URL("../src/app/dashboard/page.tsx", import.meta.url), "utf8");

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
