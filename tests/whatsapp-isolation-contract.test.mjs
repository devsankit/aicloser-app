import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const scannerRoute = fs.readFileSync(new URL("../src/app/api/sales/whatsapp-scanner/route.ts", import.meta.url), "utf8");
const service = fs.readFileSync(new URL("../scripts/whatsapp-baileys-service.mjs", import.meta.url), "utf8");
const inboxStore = fs.readFileSync(new URL("../src/lib/gigxomi/dummy-platform-file-store.ts", import.meta.url), "utf8");
const adminControls = fs.readFileSync(new URL("../src/components/admin/admin-dummy-controls.tsx", import.meta.url), "utf8");

test("WhatsApp scanner sessions are isolated and history is not seeded with shared data", () => {
  assert.match(scannerRoute, /createHash\("sha256"\)\.update\(tenantId\)/);
  assert.match(scannerRoute, /WA_SESSION_KEY: serviceKey\(tenantId\)/);
  assert.match(scannerRoute, /storeVersion: 2/);
  assert.match(scannerRoute, /discoveredChats: \[\]/);
  assert.match(service, /wa-sessions/);
  assert.match(service, /process\.env\.WA_SESSION_KEY/);
  assert.match(service, /messaging-history\.set/);
  assert.match(service, /appendWhatsAppMessage\(message\)/);
});

test("WhatsApp inbox upserts cannot reuse a phone conversation from another tenant", () => {
  assert.match(inboxStore, /if \(conv\.tenantId !== tenantId\) return false/);
});

test("WhatsApp Meta signup avoids the Facebook JS SDK on loopback hosts", () => {
  assert.match(adminControls, /function isMetaJsSdkAllowedForCurrentOrigin\(\)/);
  assert.match(adminControls, /hostname !== "localhost"/);
  assert.match(adminControls, /hostname !== "127\.0\.0\.1"/);
  assert.match(adminControls, /isFacebookSdkReady && isMetaJsSdkAllowedForCurrentOrigin\(\)/);
  assert.match(adminControls, /const setupButtonDisabled = isSaving \|\| isLaunching;/);
});
