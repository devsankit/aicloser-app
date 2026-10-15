import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const read = (...segments) => fs.readFileSync(path.join(process.cwd(), ...segments), "utf8");

test("mobile bootstrap counts and previews only claimable leads in the agent workspace", () => {
  const source = read("src", "lib", "gigxomi", "sales-mobile-store.ts");
  assert.ok(source.includes("const tenantId = agent.tenantId || agent.user.tenantId;"));
  assert.ok(source.includes("tenantId,"));
  assert.ok(source.includes('status: "OPEN" as const'));
  assert.ok(source.includes("const availableLeadCount = canRequestLeads"));
  assert.ok(source.includes("prisma.salesLeadPoolItem.count({ where: availablePoolWhere })"));
  assert.ok(source.includes("availableLeadCount,"));
});

test("mobile lead-pack request uses the same workspace and assigned/unassigned eligibility filter", () => {
  const source = read("src", "lib", "gigxomi", "sales-mobile-store.ts");
  assert.ok(source.includes('where: { tenantId, status: "OPEN", OR: [{ assignedAgentId: null }, { assignedAgentId: agent.id }] }'));
  assert.ok(source.includes('where: { tenantId, agentId: agent.id, status: "OFFERED"'));
});

test("lead pool claim is tenant-scoped and atomically reserves an open item", () => {
  const source = read("src", "lib", "gigxomi", "sales-store.ts");
  assert.ok(source.includes("poolItem.tenantId !== tenantId"));
  assert.ok(source.includes('where: { id: poolItem.id, tenantId, status: "OPEN" }'));
  assert.ok(source.includes("if (reserved.count !== 1) throw new Error(\"This lead has already been claimed.\")"));
});

test("website-intake leads are created in the default workspace and only assigned within it", () => {
  const source = read("src", "lib", "gigxomi", "sales-store.ts");
  assert.ok(source.includes('const intakeTenantId = "tenant-gigxomi";'));
  assert.ok(source.includes("user: { tenantId: intakeTenantId }"));
});
