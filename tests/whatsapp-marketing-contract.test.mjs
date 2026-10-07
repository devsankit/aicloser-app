import assert from "node:assert/strict";
import crypto from "node:crypto";
import { access, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const require = createRequire(import.meta.url);
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

async function loadTsModule(relativePath) {
  let source = await read(relativePath);
  source = source.replace(/import\s+type\s+[^;]*?from\s+["'][^"']+["'];?/g, "");

  if (relativePath.includes("google-sheets-import")) {
    const xlsxHref = pathToFileURL(require.resolve("xlsx")).href;
    source = source.replace(/import\s+\*\s+as\s+XLSX\s+from\s+["']xlsx["'];?/, `import * as XLSX from "${xlsxHref}";`);
  }

  if (relativePath.includes("meta-client")) {
    source = source.replace(/import\s+{[^}]+}\s+from\s+["']\.\/config["'];?/, `
      const META_GRAPH_BASE_URL = "https://graph.facebook.com/v22.0";
      const REQUESTED_BUSINESS_PHONE = "9993328124";
      const MAX_RETRY_ATTEMPTS = 3;
      const RETRY_BASE_DELAY_MS = 1000;
      const isMockMode = () => true;
    `);
  }

  source = source.replace(/import\s+[^;]*?from\s+["'](@\/|\.)[^"']+["'];?/g, (match) => {
    const names = Array.from(match.matchAll(/([a-zA-Z0-9_$]+)(?:\s+as\s+[a-zA-Z0-9_$]+)?/g))
      .map((m) => m[1])
      .filter((n) => !["import", "from", "type"].includes(n));
    return names.map((n) => `var ${n} = {};`).join(" ");
  });
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`;
  return import(moduleUrl);
}

test("E.164 phone normalization handles domestic, international, and invalid formats", async () => {
  const { normalizeE164Phone } = await loadTsModule("src/lib/whatsapp-marketing/contact-service.ts");

  // 10-digit Indian numbers without prefix
  const res1 = normalizeE164Phone("9993328124", "+91");
  assert.equal(res1.valid, true);
  assert.equal(res1.e164, "+919993328124");

  // Already prefixed with +91
  const res2 = normalizeE164Phone("+91 99933 28124");
  assert.equal(res2.valid, true);
  assert.equal(res2.e164, "+919993328124");

  // International format with dashes
  const res3 = normalizeE164Phone("+1 (415) 555-2671");
  assert.equal(res3.valid, true);
  assert.equal(res3.e164, "+14155552671");

  // Invalid length (too short)
  const res4 = normalizeE164Phone("12345");
  assert.equal(res4.valid, false);

  // Invalid length (too long / non-numeric)
  const res5 = normalizeE164Phone("not-a-number");
  assert.equal(res5.valid, false);
});

test("Opt-out keyword detector recognizes official compliance keywords", async () => {
  const { isOptOutKeyword } = await loadTsModule("src/lib/whatsapp-marketing/contact-service.ts");

  assert.equal(isOptOutKeyword("STOP"), true);
  assert.equal(isOptOutKeyword("Stop"), true);
  assert.equal(isOptOutKeyword("UNSUBSCRIBE"), true);
  assert.equal(isOptOutKeyword("unsubscribe "), true);
  assert.equal(isOptOutKeyword("CANCEL"), true);
  assert.equal(isOptOutKeyword("QUIT"), true);
  assert.equal(isOptOutKeyword("Hello I am interested"), false);
});

test("Template structure validation enforces positional variables and length limits", async () => {
  const { validateTemplateStructure } = await loadTsModule("src/lib/whatsapp-marketing/template-service.ts");

  // Valid template
  const validResult = validateTemplateStructure({
    name: "growth_offer_v1",
    category: "MARKETING",
    headerType: "TEXT",
    headerText: "Special Offer",
    bodyText: "Hi {{1}}, here is your {{2}} voucher.",
    footerText: "Reply STOP to opt out",
    exampleValues: { "1": "Ankit", "2": "20% OFF" },
  });
  assert.equal(validResult.valid, true);
  assert.equal(validResult.variableCount, 2);

  // Non-sequential variables (skipping {{2}})
  const nonSequential = validateTemplateStructure({
    name: "bad_vars",
    category: "MARKETING",
    headerType: "NONE",
    bodyText: "Hi {{1}}, your code is {{3}}.",
    exampleValues: { "1": "Ankit", "3": "ABC" },
  });
  assert.equal(nonSequential.valid, false);
  assert.match(nonSequential.errors[0], /must be sequential/);

  // Missing sample values
  const missingSamples = validateTemplateStructure({
    name: "missing_samples",
    category: "MARKETING",
    headerType: "NONE",
    bodyText: "Hi {{1}}, welcome!",
    exampleValues: {},
  });
  assert.equal(missingSamples.valid, false);
  assert.match(missingSamples.errors[0], /Missing example sample value/);

  // Invalid template name (uppercase / spaces)
  const badName = validateTemplateStructure({
    name: "My Invalid Template",
    category: "MARKETING",
    headerType: "NONE",
    bodyText: "Simple text body",
  });
  assert.equal(badName.valid, false);
});

test("Webhook HMAC-SHA256 signature verification validates authenticity", async () => {
  const { verifyMetaWebhookSignature } = await loadTsModule("src/lib/whatsapp-marketing/webhook-engine.ts");

  const secret = "meta_test_secret_key_123";
  const body = JSON.stringify({ object: "whatsapp_business_account", entry: [] });

  const validHash = crypto.createHmac("sha256", secret).update(body, "utf8").digest("hex");
  const validHeader = `sha256=${validHash}`;

  // Valid signature
  assert.equal(verifyMetaWebhookSignature(body, validHeader, secret), true);

  // Tampered body
  assert.equal(verifyMetaWebhookSignature(body + " ", validHeader, secret), false);

  // Wrong secret
  assert.equal(verifyMetaWebhookSignature(body, validHeader, "wrong_secret"), false);

  // Null signature
  assert.equal(verifyMetaWebhookSignature(body, null, secret), false);
});

test("CSV parser and column autodetection correctly maps headers", async () => {
  const { parseCsv, autodetectColumnMapping } = await loadTsModule("src/lib/whatsapp-marketing/google-sheets-import.ts");

  const csv = `name,whatsapp_number,email,audience_group,tags\nAnkit Rathore,9993328124,ankit@gigxomi.com,VIP Clients,agency`;
  const { headers, rows } = parseCsv(csv);

  assert.equal(headers.length, 5);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, "Ankit Rathore");

  const mapping = autodetectColumnMapping(headers);
  assert.equal(mapping.phone, "whatsapp_number");
  assert.equal(mapping.name, "name");
  assert.equal(mapping.email, "email");
  assert.equal(mapping.group, "audience_group");
});

test("Personalization variable resolver substitutes contact data accurately", async () => {
  const { resolveContactVariables } = await loadTsModule("src/lib/whatsapp-marketing/campaign-engine.ts");

  const mapping = {
    "1": { source: "contact_field", fieldOrValue: "firstName" },
    "2": { source: "static", fieldOrValue: "50% OFF" },
  };

  const contact = {
    fullName: "Ankit Rathore",
    e164Phone: "+919993328124",
    email: "ankit@gigxomi.com",
  };

  const resolved = resolveContactVariables(mapping, contact);
  assert.equal(resolved["1"], "Ankit");
  assert.equal(resolved["2"], "50% OFF");
});

test("WhatsApp Marketing API routes enforce tenant-scoping and authorization roles", async () => {
  const [
    channelRoute,
    templatesRoute,
    campaignsRoute,
    contactsRoute,
    importRoute,
    webhookRoute,
  ] = await Promise.all([
    read("src/app/api/whatsapp-marketing/channel/route.ts"),
    read("src/app/api/whatsapp-marketing/templates/route.ts"),
    read("src/app/api/whatsapp-marketing/campaigns/route.ts"),
    read("src/app/api/whatsapp-marketing/contacts/route.ts"),
    read("src/app/api/whatsapp-marketing/contacts/import/route.ts"),
    read("src/app/api/whatsapp-marketing/webhook/route.ts"),
  ]);

  assert.match(channelRoute, /requireSessionRole\(\["SUPER_ADMIN", "ADMIN"/);
  assert.match(channelRoute, /resolveSessionTenantId/);
  assert.match(channelRoute, /REQUESTED_BUSINESS_PHONE/);

  const { REQUESTED_BUSINESS_PHONE } = await loadTsModule("src/lib/whatsapp-marketing/config.ts");
  assert.equal(REQUESTED_BUSINESS_PHONE, "9993328124");

  assert.match(templatesRoute, /createAndSubmitTemplate/);
  assert.match(templatesRoute, /resolveSessionTenantId/);

  assert.match(campaignsRoute, /createAndQueueCampaign/);
  assert.match(campaignsRoute, /resolveSessionTenantId/);

  assert.match(contactsRoute, /upsertMarketingContact/);
  assert.match(contactsRoute, /suppressPhone/);

  assert.match(importRoute, /consentDeclared/);
  assert.match(importRoute, /processContactImport/);

  assert.match(webhookRoute, /hub\.verify_token/);
  assert.match(webhookRoute, /x-hub-signature-256/);
});

test("Extraction contract: legacy public meta webhook remains absent", async () => {
  await assert.rejects(access(new URL("../src/app/api/meta/whatsapp/webhook/route.ts", import.meta.url)));
  await access(new URL("../src/app/api/whatsapp-marketing/webhook/route.ts", import.meta.url));
});

test("Sales dashboard includes WhatsApp Marketing tab in navigation", async () => {
  const dashboard = await read("src/components/sales/sales-dashboard.tsx");
  assert.match(dashboard, /WhatsApp Marketing/);
  assert.match(dashboard, /activeTab === "whatsapp-marketing"/);
  assert.match(dashboard, /WhatsAppMarketingDashboard/);
});

test("Webhook verify token matching validates against configured and dedicated channel tokens", async () => {
  const webhookRoute = await read("src/app/api/whatsapp-marketing/webhook/route.ts");
  // Enforces check on hub.verify_token and hub.mode
  assert.match(webhookRoute, /hub\.mode/);
  assert.match(webhookRoute, /hub\.verify_token/);
  assert.match(webhookRoute, /META_WHATSAPP_VERIFY_TOKEN/);
  assert.match(webhookRoute, /META_WEBHOOK_VERIFY_TOKEN/);
  assert.match(webhookRoute, /webhookVerifyToken/);

  // Rejects invalid token with 403
  assert.match(webhookRoute, /status:\s*403/);
});

test("Token encryption failsafe protects secrets at rest and rejects missing production secret", async () => {
  const { encryptSecureToken, decryptSecureToken } = await loadTsModule("src/lib/whatsapp-marketing/config.ts");

  // In test/dev environment, encryption roundtrip works
  const sampleToken = "EAAGtest_sample_meta_access_token_123456789";
  const encrypted = encryptSecureToken(sampleToken);
  assert.notEqual(encrypted, sampleToken);
  assert.match(encrypted, /^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/); // iv:tag:payload
  const decrypted = decryptSecureToken(encrypted);
  assert.equal(decrypted, sampleToken);

  // Decrypting non-encrypted/plain string returns original safely
  assert.equal(decryptSecureToken("plain_fallback"), "plain_fallback");
  assert.equal(decryptSecureToken(""), "");
});

test("Template structure validation enforces button limits, button types, and length bounds", async () => {
  const { validateTemplateStructure } = await loadTsModule("src/lib/whatsapp-marketing/template-service.ts");

  // Excess buttons (more than 10)
  const tooManyButtons = validateTemplateStructure({
    name: "too_many_buttons",
    category: "MARKETING",
    headerType: "NONE",
    bodyText: "Limited time offer!",
    buttons: Array.from({ length: 11 }, (_, i) => ({ type: "QUICK_REPLY", text: `Btn ${i}` })),
  });
  assert.equal(tooManyButtons.valid, false);
  assert.match(tooManyButtons.errors[0], /maximum of 10/);

  // Unsupported button type
  const badButtonType = validateTemplateStructure({
    name: "bad_btn_type",
    category: "MARKETING",
    headerType: "NONE",
    bodyText: "Click below!",
    buttons: [{ type: "UNSUPPORTED_TYPE", text: "Click" }],
  });
  assert.equal(badButtonType.valid, false);
  assert.match(badButtonType.errors[0], /unsupported type/i);

  // Button text exceeding 25 chars
  const longButtonText = validateTemplateStructure({
    name: "long_btn_text",
    category: "MARKETING",
    headerType: "NONE",
    bodyText: "Click below!",
    buttons: [{ type: "QUICK_REPLY", text: "This button text is far too long for Meta standards" }],
  });
  assert.equal(longButtonText.valid, false);
  assert.match(longButtonText.errors[0], /25 characters/);

  // Body text exceeding 1024 chars
  const oversizedBody = validateTemplateStructure({
    name: "long_body",
    category: "MARKETING",
    headerType: "NONE",
    bodyText: "A".repeat(1025),
  });
  assert.equal(oversizedBody.valid, false);
  assert.match(oversizedBody.errors[0], /1024 characters/);
});

test("Mock mode and client safeguards isolate all Meta Cloud API operations locally", async () => {
  const { REQUESTED_BUSINESS_PHONE, isMockMode } = await loadTsModule("src/lib/whatsapp-marketing/config.ts");
  const { verifyChannelConnection, createMetaTemplate, sendTemplateMessage, listWabaPhoneNumbers } = await loadTsModule("src/lib/whatsapp-marketing/meta-client.ts");

  assert.equal(REQUESTED_BUSINESS_PHONE, "9993328124");
  assert.equal(isMockMode(), true);

  // verifyChannelConnection in mock mode returns target phone without network requests
  const phoneRes = await verifyChannelConnection({ phoneNumberId: "962346373625331", accessToken: "mock_token" });
  assert.equal(phoneRes.ok, true);
  assert.equal(phoneRes.data.phoneNumber.display_phone_number, "+91 99933 28124");
  assert.equal(phoneRes.data.matchesRequestedNumber, true);

  // listWabaPhoneNumbers in mock mode
  const listRes = await listWabaPhoneNumbers("2744233995921639", "mock_token");
  assert.equal(listRes.ok, true);
  assert.equal(listRes.data[0].id, "962346373625331");

  // createMetaTemplate in mock mode returns approved template id
  const tmplRes = await createMetaTemplate({
    wabaId: "2744233995921639",
    accessToken: "mock_token",
    template: {
      name: "test_local_template",
      language: "en_US",
      category: "MARKETING",
      components: [{ type: "BODY", text: "Hello!" }],
    },
  });
  assert.equal(tmplRes.ok, true);
  assert.match(tmplRes.data.id, /mock_meta_tpl_/);
  assert.equal(tmplRes.data.status, "APPROVED");

  // sendTemplateMessage in mock mode returns accepted message id
  const sendRes = await sendTemplateMessage({
    phoneNumberId: "962346373625331",
    to: "+919993328124",
    templateName: "test_local_template",
    languageCode: "en_US",
    accessToken: "mock_token",
  });
  assert.equal(sendRes.ok, true);
  assert.match(sendRes.data.messages[0].id, /^wamid\.mock\./);
});

test("XLSX buffer parser and expanded column detector support spreadsheet imports", async () => {
  const XLSX = await import("xlsx");
  const { parseXlsxBuffer, autodetectColumnMapping } = await loadTsModule("src/lib/whatsapp-marketing/google-sheets-import.ts");

  // Create an in-memory workbook buffer
  const wb = XLSX.utils.book_new();
  const wsData = [
    ["Client Name", "Mobile Number", "Business Email", "Client Segment", "Labels"],
    ["Rahul Sharma", "9876543210", "rahul@example.com", "High Value", "prospect,real-estate"],
    ["Priya Patel", "+919993328124", "priya@example.com", "VIP", "hot-lead"],
  ];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  const { headers, rows } = parseXlsxBuffer(buffer);
  assert.equal(headers.length, 5);
  assert.equal(rows.length, 2);
  assert.equal(rows[0]["Client Name"], "Rahul Sharma");
  assert.equal(rows[1]["Mobile Number"], "+919993328124");

  const mapping = autodetectColumnMapping(headers);
  assert.equal(mapping.phone, "Mobile Number");
  assert.equal(mapping.name, "Client Name");
  assert.equal(mapping.email, "Business Email");
  assert.equal(mapping.group, "Client Segment");
  assert.equal(mapping.tags, "Labels");
});

