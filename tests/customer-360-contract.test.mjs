import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("journey contract accepts versioned allowlisted events and rejects unknown events", async () => {
  const source = await read("src/lib/gxclosers/journey-contract.ts");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`;
  const { validateJourneyEnvelope } = await import(moduleUrl);
  const base = {
    eventId: "event-1",
    eventKey: "webinar-registration:registration-1",
    eventType: "webinar.registered",
    eventVersion: 1,
    occurredAt: new Date().toISOString(),
    source: "ANKIT_WEBINAR_WEB",
    subjectId: "registration-1",
    subjectType: "WEBINAR_REGISTRATION",
  };

  assert.equal(validateJourneyEnvelope({ event: base }).ok, true);
  assert.deepEqual(validateJourneyEnvelope({ event: { ...base, eventType: "admin.make_superuser" } }), {
    ok: false,
    error: "The journey event type is not supported.",
  });
  assert.deepEqual(validateJourneyEnvelope({ event: { ...base, eventVersion: 2 } }), {
    ok: false,
    error: "The journey event version is not supported.",
  });
});

test("internal ingestion requires a timestamped HMAC and has no public GET", async () => {
  const signature = await read("src/lib/gxclosers/journey-signature.ts");
  const route = await read("src/app/api/internal/v1/journey-events/route.ts");

  assert.match(signature, /createHmac\("sha256"/);
  assert.match(signature, /MAX_CLOCK_SKEW_MS = 5 \* 60 \* 1000/);
  assert.match(signature, /timingSafeEqual/);
  assert.match(route, /MAX_BODY_BYTES = 256 \* 1024/);
  assert.doesNotMatch(route, /export async function GET/);
});

test("Customer 360 remains authenticated and lead-scoped", async () => {
  const customerRoute = await read("src/app/api/sales/leads/[leadId]/customer-360/route.ts");
  const taskRoute = await read("src/app/api/sales/leads/[leadId]/tasks/route.ts");
  const service = await read("src/lib/gxclosers/customer-360.ts");

  assert.match(customerRoute, /requireSessionRole\(\["SUPER_ADMIN", "SALES_AGENT"\]\)/);
  assert.match(customerRoute, /snapshot\.visibleLeads\.some/);
  assert.match(taskRoute, /snapshot\.visibleLeads\.some/);
  assert.doesNotMatch(service, /recordingPath/);
  assert.match(service, /hasRecording/);
});

test("GX journey code does not add Meta webhooks or import protected chat modules", async () => {
  const combined = (await Promise.all([
    "src/lib/gxclosers/journey-ingestion.ts",
    "src/lib/gxclosers/customer-360.ts",
    "src/app/api/internal/v1/journey-events/route.ts",
  ].map(read))).join("\n");

  assert.doesNotMatch(combined, /@\/lib\/gigxomi\/.*(?:chat|conversation|whatsapp|instagram)/i);
  assert.doesNotMatch(combined, /src\/app\/api\/meta|webhook/i);
  assert.doesNotMatch(combined, /defaultTenant|fallbackTenant/i);
});

test("owner bootstrap has no committed password and preserves an existing hash", async () => {
  const authStore = await read("src/lib/auth/store.ts");
  const environment = await read(".env.example");

  assert.doesNotMatch(authStore, /const SUPER_ADMIN_PASSWORD/);
  assert.match(authStore, /GXCLOSERS_SUPER_ADMIN_BOOTSTRAP_PASSWORD/);
  assert.match(authStore, /existing\.passwordHash/);
  assert.match(environment, /Remove it from the runtime environment after the owner can sign in/);
  assert.doesNotMatch(environment, /GXCLOSERS_SUPER_ADMIN_BOOTSTRAP_PASSWORD=\S+/);
});

test("GXClosers keeps only the Sales-facing webinar projection", async () => {
  const store = await read("src/lib/gigxomi/gapp-webinar-store.ts");

  assert.match(store, /listGappRegistrationsForFollowUp/);
  assert.match(store, /priceMode: "FREE"/);
  assert.doesNotMatch(store, /PhonePeHttpClient|registerForGappWebinar|processGappPaymentWebhook|payment\/webhook/);
});
