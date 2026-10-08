import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Excel commit returns the exact created queue IDs and a batch identity", async () => {
  const route = await source("src/app/api/sales/leads/import/route.ts");
  assert.match(route, /const importBatchId = crypto\.randomUUID\(\)/);
  assert.match(route, /poolItemIds\.push\(poolItem\.id\)/);
  assert.match(route, /importBatchId,\s*poolItemIds,/);
});

test("Round-robin rejects an empty selection and claims only scoped OPEN items", async () => {
  const route = await source("src/app/api/sales/round-robin/route.ts");
  assert.match(route, /!targetLeadIds\.length && !targetPoolItemIds\.length && !targetContacts\.length/);
  assert.match(route, /DISTRIBUTION_SELECTION_REQUIRED/);
  assert.match(route, /id: \{ in: targetPoolItemIds \}, tenantId, status: "OPEN"/);
  assert.doesNotMatch(route, /leadsToDistribute = await prisma\.salesLeadAssignment\.findMany\(\{\s*where: \{ stage: "NEW"/);
});

test("Contacts hub preserves an exact import batch and never defaults to all contacts", async () => {
  const ui = await source("src/components/sales/contacts-hub.tsx");
  assert.match(ui, /aicloser-import-batch:\$\{tenantId\}/);
  assert.match(ui, /pendingImportBatch\?\.poolItemIds/);
  assert.match(ui, /contacts: targetContacts\.filter\(\(c\) => !c\.poolItemId\)/);
  assert.match(ui, /contacts\.filter\(\(c\) => selectedIds\.has\(c\.id\)\)\s*: \[\]/);
});
