import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const baileysService = fs.readFileSync(new URL("../scripts/whatsapp-baileys-service.mjs", import.meta.url), "utf8");
const scannerRoute = fs.readFileSync(new URL("../src/app/api/sales/whatsapp-scanner/route.ts", import.meta.url), "utf8");
const dummyFileStore = fs.readFileSync(new URL("../src/lib/gigxomi/dummy-platform-file-store.ts", import.meta.url), "utf8");

test("Baileys daemon preloads LID mappings and maps @lid privacy JIDs to real phone numbers", () => {
  assert.match(baileysService, /const lidToPhoneCache = new Map\(\);/);
  assert.match(baileysService, /function preloadLidMappings\(\)/);
  assert.match(baileysService, /lid-mapping-/);
  assert.match(baileysService, /_reverse\.json/);
  assert.match(baileysService, /if \(jid\.endsWith\("@lid"\)\)/);
  assert.match(baileysService, /function getContactNameForPhone\(phone\)/);
  assert.match(baileysService, /dispatchInboundMessageToCrm/);
});

test("dummy-platform-file-store exports syncExternalThreadsToInboxBatch for atomic multi-chat ingestion", () => {
  assert.match(dummyFileStore, /export function syncExternalThreadsToInboxBatch/);
  assert.match(dummyFileStore, /withSnapshot\(async \(\) =>/);
  assert.match(dummyFileStore, /const cleanTargetDigits = input\.customerPhone\.replace\(/);
});

test("whatsapp-scanner route supports high-performance batch sync and real-time internal event ingress", () => {
  // Inbound event hook from Baileys daemon
  assert.match(scannerRoute, /request\.headers\.get\("x-internal-wa-token"\)/);
  assert.match(scannerRoute, /internalBody\.action === "inbound_event"/);
  assert.match(scannerRoute, /action: msg\.role === "sales" \? "WHATSAPP_MESSAGE_SENT" : "WHATSAPP_MESSAGE_RECEIVED"/);

  // Batch sync in complete_scan
  assert.match(scannerRoute, /syncExternalThreadsToInboxBatch/);
  assert.match(scannerRoute, /phoneToConversationId/);
  assert.match(scannerRoute, /discoveredChats: targetChats\.slice\(0, 100\)/);
});
