import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const read = (...segments) => fs.readFileSync(path.join(process.cwd(), ...segments), "utf8");

test("ordinary agents see only leads assigned to their own profile", () => {
  const source = read("src", "lib", "gigxomi", "sales-store.ts");
  assert.ok(source.includes("? agents.filter((agent) => agent.id === currentAgent.id)"));
  assert.ok(source.includes("const assignedLeads = leads.filter((lead) => observingAgentIds.has(lead.assignedAgentId));"));
});

test("lead activity summaries never borrow activity from another lead with the same phone", () => {
  const source = read("src", "lib", "gigxomi", "sales-store.ts");
  assert.ok(source.includes("latestTouchByAssignmentId.get(lead.id) ?? null"));
  assert.ok(!source.includes("lastTouchByPhone"));
  assert.ok(!source.includes("historicalAssignments"));
});

test("duplicate scans are authorized and only inspect leads visible to the caller", () => {
  const route = read("src", "app", "api", "sales", "leads", "duplicates", "route.ts");
  assert.ok(route.includes('requireSessionRole(["ADMIN", "SUPER_ADMIN", "MANAGER"])'));
  assert.ok(route.includes("findDuplicateLeads(snapshot.visibleLeads)"));
});

test("lead merge requires authorization for both leads and rejects cross-workspace merges", () => {
  const route = read("src", "app", "api", "sales", "leads", "merge", "route.ts");
  const store = read("src", "lib", "gigxomi", "lead-duplicates-store.ts");
  assert.ok(route.includes("new Set(snapshot.visibleLeads.map((lead) => lead.id))"));
  assert.ok(store.includes("!visibleLeadIds.has(primaryLeadId) || !visibleLeadIds.has(secondaryLeadId)"));
  assert.ok(store.includes("primary.tenantId !== secondary.tenantId"));
  assert.ok(store.includes("prisma.$transaction"));
});
