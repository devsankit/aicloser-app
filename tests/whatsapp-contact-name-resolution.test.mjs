import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const baileysService = fs.readFileSync(new URL("../scripts/whatsapp-baileys-service.mjs", import.meta.url), "utf8");
const dummyFileStore = fs.readFileSync(new URL("../src/lib/gigxomi/dummy-platform-file-store.ts", import.meta.url), "utf8");
const contactsRoute = fs.readFileSync(new URL("../src/app/api/sales/contacts/route.ts", import.meta.url), "utf8");

test("Baileys service preloads bidirectional LID mappings and resolves contact names", () => {
  assert.match(baileysService, /lid-mapping-.*\.json/);
  assert.match(baileysService, /lidToPhoneCache\.set\(lidDigits/);
  assert.match(baileysService, /function getContactNameForPhone\(phone\)/);
  assert.match(baileysService, /const contactName = getContactNameForPhone\(phone/);
  assert.match(baileysService, /existing\.name = contactName/);
});

test("dummy-platform-file-store upgrades customerName and title when real human name is synced", () => {
  assert.match(dummyFileStore, /const isTelemetryOrLid = \(val: string\) =>/);
  assert.match(dummyFileStore, /if \(incomingName && !isTelemetryOrLid\(incomingName\) && isTelemetryOrLid\(existingName\)\)/);
  assert.match(dummyFileStore, /existing\.customerName = incomingName;/);
  assert.match(dummyFileStore, /existing\.title = incomingName;/);
});

test("Contacts route prioritizes real human names over phone numbers and LIDs", () => {
  assert.match(contactsRoute, /const isBadName = \(n: string\) =>/);
  assert.match(contactsRoute, /if \(mc\.fullName && !isBadName\(mc\.fullName\) && isBadName\(existing\.name\)\)/);
  assert.match(contactsRoute, /existing\.name = mc\.fullName;/);
  assert.match(contactsRoute, /if \(conv\.customerDisplayName && !isBadName\(conv\.customerDisplayName\) && isBadName\(existing\.name\)\)/);
  assert.match(contactsRoute, /existing\.name = conv\.customerDisplayName;/);
});
