import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const dashboard = fs.readFileSync(new URL("../src/components/sales/sales-dashboard.tsx", import.meta.url), "utf8");

test("lead form builder receives the authenticated workspace admin role", () => {
  assert.match(dashboard, /<LeadFormBuilder\s+isAdmin=\{isWorkspaceAdmin\}/);
  assert.doesNotMatch(dashboard, /<LeadFormBuilder\s+isAdmin=\{true\}/);
});

test("closer navigation stays limited to the closer workspace surface", () => {
  assert.match(dashboard, /tabs\.filter\(\(tab\) => \["dashboard", "crm", "grab-leads", "conversations"\]\.includes\(tab\.id\)\)/);
  assert.match(dashboard, /const isCloser = !isWorkspaceAdmin && effectiveWorkspaceRole === "SALES_AGENT"/);
});
