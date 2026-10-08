import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/lib/gigxomi/sales-mobile-store.ts", import.meta.url), "utf8");

test("recording reads remain tenant-scoped for privileged and closer sessions", () => {
  assert.match(source, /const tenantId = agent\?\.tenantId \?\?/);
  assert.match(source, /if \(!tenantId\) throw new Error/);
  assert.match(source, /\? \{ id: callId, tenantId \}/);
  assert.match(source, /\{ id: callId, tenantId, OR:/);
});
