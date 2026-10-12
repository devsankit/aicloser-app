import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Prisma schema defines clientCallId with tenant+agent unique constraint and index", async () => {
  const schema = await read("prisma/schema.prisma");
  assert.match(schema, /model SalesMobileCall \{/);
  assert.match(schema, /clientCallId\s+String\?/);
  assert.match(schema, /@@unique\(\[tenantId, agentId, clientCallId\]\)/);
  assert.match(schema, /@@index\(\[clientCallId\]\)/);
});

test("startSalesMobileCall checks clientCallId idempotency before pending guard and handles P2002 race", async () => {
  const store = await read("src/lib/gigxomi/sales-mobile-store.ts");

  // Client call key extracted
  assert.match(store, /const clientCallId = clean\(input\.clientCallId \|\| input\.callSessionId \|\| input\.idempotencyKey \|\| input\.callId\);/);

  // Idempotency check occurs before pending note check
  const startFnIdx = store.indexOf("export async function startSalesMobileCall");
  const idempotencyIdx = store.indexOf("const existing = await prisma.salesMobileCall.findFirst({", startFnIdx);
  const pendingCheckIdx = store.indexOf("const pending = await prisma.salesMobileCall.count", startFnIdx);

  assert.ok(idempotencyIdx > startFnIdx, "Idempotency check must be present in startSalesMobileCall");
  assert.ok(pendingCheckIdx > idempotencyIdx, "Idempotency check must run before pending disposition guard");

  // Lookup is scoped to tenantId and agentId and checks clientCallId OR id
  const idempotencyBlock = store.slice(idempotencyIdx, pendingCheckIdx);
  assert.match(idempotencyBlock, /tenantId: agent\.tenantId/);
  assert.match(idempotencyBlock, /agentId: agent\.id/);
  assert.match(idempotencyBlock, /OR:\s*\[\s*\{\s*clientCallId\s*\},/);
  assert.match(idempotencyBlock, /if \(existing\) \{\s*return existing;\s*\}/);

  // P2002 race handling
  assert.match(store, /if \(error instanceof Prisma\.PrismaClientKnownRequestError && error\.code === "P2002" && clientCallId\)/);
  assert.match(store, /const raced = await prisma\.salesMobileCall\.findFirst/);
});

test("endSalesMobileCall resolves call by either database ID or clientCallId scoped to agent", async () => {
  const store = await read("src/lib/gigxomi/sales-mobile-store.ts");
  const endFnIdx = store.indexOf("export async function endSalesMobileCall");
  const endFn = store.slice(endFnIdx, endFnIdx + 1200);

  assert.match(endFn, /const callId = clean\(input\.clientCallId \|\| input\.callSessionId \|\| input\.idempotencyKey \|\| input\.callId\);/);
  assert.match(endFn, /where:\s*\{\s*tenantId: agent\.tenantId,\s*agentId: agent\.id,\s*OR:\s*\[\{\s*id: callId\s*\},\s*\{\s*clientCallId: callId\s*\}\]/);
});

test("saveSalesMobileRecording supports clientCallId lookup and prevents duplicate rows on upload retry", async () => {
  const store = await read("src/lib/gigxomi/sales-mobile-store.ts");
  const uploadFnIdx = store.indexOf("export async function saveSalesMobileRecording");
  const uploadFn = store.slice(uploadFnIdx, uploadFnIdx + 1600);

  assert.match(uploadFn, /where:\s*\{\s*tenantId,\s*agentId: agent\.id,\s*OR:\s*\[\{\s*id: callId\s*\},\s*\{\s*clientCallId: callId\s*\}\]/);
  assert.match(uploadFn, /clientCallId: clean\(callId\) \|\| null/);
  assert.match(uploadFn, /error\.code === "P2002"/);
});

test("submitSalesMobileDisposition and discardSalesMobileCall support clientCallId lookup", async () => {
  const store = await read("src/lib/gigxomi/sales-mobile-store.ts");

  const dispFnIdx = store.indexOf("export async function submitSalesMobileDisposition");
  const dispFn = store.slice(dispFnIdx, dispFnIdx + 800);
  assert.match(dispFn, /OR:\s*\[\{\s*id: callId\s*\},\s*\{\s*clientCallId: callId\s*\}\]/);

  const discardFnIdx = store.indexOf("export async function discardSalesMobileCall");
  const discardFn = store.slice(discardFnIdx, discardFnIdx + 1200);
  assert.match(discardFn, /OR:\s*\[\{\s*id: callId\s*\},\s*\{\s*clientCallId: callId\s*\}\]/);
  assert.match(discardFn, /where:\s*\{\s*id: existing\.id\s*\}/);
});

test("recording upload route passes clientCallId to saveSalesMobileRecording", async () => {
  const route = await read("src/app/api/sales/mobile/call/recording-upload/route.ts");
  assert.match(route, /form\.get\("clientCallId"\) \?\? form\.get\("callSessionId"\)/);
});

test("Android CrmRepository generates and sends clientCallId, callSessionId, and idempotencyKey", async () => {
  const repo = await read("apps/crm-mobile/app/src/main/java/com/gigxomi/gxclosers/data/CrmRepository.kt");

  // startCall
  assert.match(repo, /fun startCall\(.*?callSessionId:\s*String\?\s*=\s*null.*?String/s);
  assert.match(repo, /val clientKey = callSessionId\?\.takeIf\(String::isNotBlank\) \?: "call-\$\{java\.util\.UUID\.randomUUID\(\)\}"/);
  assert.match(repo, /\.put\("clientCallId", clientKey\)/);
  assert.match(repo, /\.put\("callSessionId", clientKey\)/);
  assert.match(repo, /\.put\("idempotencyKey", clientKey\)/);

  // startIncomingCall & startUnmatchedCall
  assert.match(repo, /fun startIncomingCall\(.*?callSessionId:\s*String\?\s*=\s*null.*?String/s);
  assert.match(repo, /fun startUnmatchedCall\(.*?callSessionId:\s*String\?\s*=\s*null.*?String/s);
});

test("Behavioral simulation: duplicate start with same idempotency key returns existing call", async () => {
  const callsDb = [];
  const startCallSim = (actor, input) => {
    const clientCallId = (input.clientCallId || input.callSessionId || input.idempotencyKey || "").trim();
    if (clientCallId) {
      const existing = callsDb.find((c) =>
        c.tenantId === actor.tenantId &&
        c.agentId === actor.agentId &&
        (c.clientCallId === clientCallId || c.id === clientCallId)
      );
      if (existing) return existing;
    }
    const newCall = {
      id: `cuid-${callsDb.length + 1}`,
      tenantId: actor.tenantId,
      agentId: actor.agentId,
      clientCallId: clientCallId || null,
      phoneNumber: input.phoneNumber,
      direction: input.direction || "OUTBOUND",
      status: "INITIATED",
    };
    callsDb.push(newCall);
    return newCall;
  };

  const actor = { tenantId: "tenant-1", agentId: "agent-1" };
  const call1 = startCallSim(actor, { clientCallId: "call-uuid-101", phoneNumber: "+919876543210" });
  assert.equal(callsDb.length, 1);
  assert.equal(call1.clientCallId, "call-uuid-101");

  // Duplicate request with same idempotency key
  const call2 = startCallSim(actor, { clientCallId: "call-uuid-101", phoneNumber: "+919876543210" });
  assert.equal(callsDb.length, 1, "Duplicate start must not create a new database row");
  assert.equal(call2.id, call1.id, "Must return the exact same call");
});

test("Behavioral simulation: lost-response retry returns existing call without creating second row", async () => {
  const callsDb = [];
  const startCallSim = (actor, input) => {
    const clientCallId = (input.clientCallId || input.callSessionId || input.idempotencyKey || "").trim();
    if (clientCallId) {
      const existing = callsDb.find((c) =>
        c.tenantId === actor.tenantId &&
        c.agentId === actor.agentId &&
        (c.clientCallId === clientCallId || c.id === clientCallId)
      );
      if (existing) return existing;
    }
    const newCall = {
      id: `cuid-${callsDb.length + 1}`,
      tenantId: actor.tenantId,
      agentId: actor.agentId,
      clientCallId: clientCallId || null,
      phoneNumber: input.phoneNumber,
      direction: input.direction || "INBOUND",
      status: "INITIATED",
    };
    callsDb.push(newCall);
    return newCall;
  };

  const actor = { tenantId: "tenant-1", agentId: "agent-1" };
  // Initial request succeeded on server, but response was lost
  const first = startCallSim(actor, { clientCallId: "call-redmi-inbound-1", phoneNumber: "+919993300000", direction: "INBOUND" });
  assert.equal(callsDb.length, 1);

  // Client worker retries after network timeout
  const retried = startCallSim(actor, { clientCallId: "call-redmi-inbound-1", phoneNumber: "+919993300000", direction: "INBOUND" });
  assert.equal(callsDb.length, 1, "Retry must not produce duplicate row");
  assert.equal(retried.id, first.id);
});

test("Behavioral simulation: offline replay, end, and upload attach to the same call", async () => {
  const callsDb = [{
    id: "cuid-call-55",
    tenantId: "tenant-1",
    agentId: "agent-1",
    clientCallId: "client-key-55",
    status: "INITIATED",
    recordingStatus: "NONE",
  }];

  const endCallSim = (actor, input) => {
    const callId = (input.clientCallId || input.callSessionId || input.callId || "").trim();
    const call = callsDb.find((c) =>
      c.tenantId === actor.tenantId &&
      c.agentId === actor.agentId &&
      (c.id === callId || c.clientCallId === callId)
    );
    if (!call) throw new Error("Call not found");
    call.status = "COMPLETED";
    return call;
  };

  const uploadSim = (actor, callId, uploadKey) => {
    const call = callsDb.find((c) =>
      c.tenantId === actor.tenantId &&
      c.agentId === actor.agentId &&
      (c.id === callId || c.clientCallId === callId)
    );
    if (!call) throw new Error("Call not found");
    call.recordingStatus = "UPLOADED";
    call.uploadKey = uploadKey;
    return call;
  };

  const actor = { tenantId: "tenant-1", agentId: "agent-1" };

  // End using clientCallId
  const ended = endCallSim(actor, { callSessionId: "client-key-55" });
  assert.equal(ended.id, "cuid-call-55");
  assert.equal(ended.status, "COMPLETED");

  // Offline replay of end event
  const replayEnded = endCallSim(actor, { callSessionId: "client-key-55" });
  assert.equal(replayEnded.id, "cuid-call-55");
  assert.equal(callsDb.length, 1);

  // Recording upload referencing clientCallId attaches to existing call
  const uploaded = uploadSim(actor, "client-key-55", "audio-upload-1");
  assert.equal(uploaded.id, "cuid-call-55");
  assert.equal(uploaded.recordingStatus, "UPLOADED");
  assert.equal(callsDb.length, 1);
});

test("Behavioral simulation: same number called twice at different times creates distinct calls", async () => {
  const callsDb = [];
  const startCallSim = (actor, input) => {
    const clientCallId = (input.clientCallId || "").trim();
    const existing = callsDb.find((c) =>
      c.tenantId === actor.tenantId &&
      c.agentId === actor.agentId &&
      c.clientCallId === clientCallId
    );
    if (existing) return existing;
    const newCall = { id: `cuid-${callsDb.length + 1}`, tenantId: actor.tenantId, agentId: actor.agentId, clientCallId, phoneNumber: input.phoneNumber };
    callsDb.push(newCall);
    return newCall;
  };

  const actor = { tenantId: "tenant-1", agentId: "agent-1" };
  const call1 = startCallSim(actor, { clientCallId: "call-session-morning", phoneNumber: "+919876543210" });
  const call2 = startCallSim(actor, { clientCallId: "call-session-afternoon", phoneNumber: "+919876543210" });

  assert.equal(callsDb.length, 2, "Two distinct call sessions must create two distinct call rows");
  assert.notEqual(call1.id, call2.id);
});

test("Behavioral simulation: opposite directions (INBOUND vs OUTBOUND) are never merged", async () => {
  const callsDb = [];
  const startCallSim = (actor, input) => {
    const clientCallId = (input.clientCallId || "").trim();
    const existing = callsDb.find((c) =>
      c.tenantId === actor.tenantId &&
      c.agentId === actor.agentId &&
      c.clientCallId === clientCallId
    );
    if (existing) return existing;
    const newCall = { id: `cuid-${callsDb.length + 1}`, tenantId: actor.tenantId, agentId: actor.agentId, clientCallId, direction: input.direction, phoneNumber: input.phoneNumber };
    callsDb.push(newCall);
    return newCall;
  };

  const actor = { tenantId: "tenant-1", agentId: "agent-1" };
  const inbound = startCallSim(actor, { clientCallId: "call-in-01", phoneNumber: "+919876543210", direction: "INBOUND" });
  const outbound = startCallSim(actor, { clientCallId: "call-out-01", phoneNumber: "+919876543210", direction: "OUTBOUND" });

  assert.equal(callsDb.length, 2);
  assert.equal(inbound.direction, "INBOUND");
  assert.equal(outbound.direction, "OUTBOUND");
});

test("Behavioral simulation: different agents/devices in the same physical call remain separate rows", async () => {
  const callsDb = [];
  const startCallSim = (actor, input) => {
    const clientCallId = (input.clientCallId || "").trim();
    const existing = callsDb.find((c) =>
      c.tenantId === actor.tenantId &&
      c.agentId === actor.agentId &&
      c.clientCallId === clientCallId
    );
    if (existing) return existing;
    const newCall = { id: `cuid-${callsDb.length + 1}`, tenantId: actor.tenantId, agentId: actor.agentId, deviceId: input.deviceId, clientCallId };
    callsDb.push(newCall);
    return newCall;
  };

  // Agent A on Phone 1 and Agent B on Phone 2
  const agentA = { tenantId: "tenant-1", agentId: "agent-1" };
  const agentB = { tenantId: "tenant-1", agentId: "agent-2" };

  const callA = startCallSim(agentA, { clientCallId: "call-conf-01", deviceId: "phone-1" });
  const callB = startCallSim(agentB, { clientCallId: "call-conf-01", deviceId: "phone-2" });

  assert.equal(callsDb.length, 2, "Different agents must each have their own call row");
  assert.equal(callA.agentId, "agent-1");
  assert.equal(callB.agentId, "agent-2");
});

test("Behavioral simulation: tenant isolation prevents cross-tenant call match or collision", async () => {
  const callsDb = [];
  const startCallSim = (actor, input) => {
    const clientCallId = (input.clientCallId || "").trim();
    const existing = callsDb.find((c) =>
      c.tenantId === actor.tenantId &&
      c.agentId === actor.agentId &&
      c.clientCallId === clientCallId
    );
    if (existing) return existing;
    const newCall = { id: `cuid-${callsDb.length + 1}`, tenantId: actor.tenantId, agentId: actor.agentId, clientCallId };
    callsDb.push(newCall);
    return newCall;
  };

  const tenant1 = { tenantId: "tenant-alpha", agentId: "agent-same-id" };
  const tenant2 = { tenantId: "tenant-beta", agentId: "agent-same-id" };

  const callTenant1 = startCallSim(tenant1, { clientCallId: "shared-key-1" });
  const callTenant2 = startCallSim(tenant2, { clientCallId: "shared-key-1" });

  assert.equal(callsDb.length, 2, "Different tenants must never match or collide");
  assert.equal(callTenant1.tenantId, "tenant-alpha");
  assert.equal(callTenant2.tenantId, "tenant-beta");
});
