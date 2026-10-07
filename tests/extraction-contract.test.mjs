import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function source(relativePath) {
  return readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

test("web CRM is hosted at the GXclosers root", async () => {
  const [page, login, nextConfig] = await Promise.all([
    source("src/app/page.tsx"),
    source("src/app/login/page.tsx"),
    source("next.config.ts"),
  ]);
  assert.match(page, /requirePageRole\(\["SALES_AGENT"\], "\/"\)/);
  assert.doesNotMatch(page, /redirect\(`\/sales/);
  assert.match(login, /redirectTo=\{value\(params\.redirectTo\) \|\| "\/"\}/);
  assert.match(nextConfig, /source: "\/sales", destination: "\/"/);
  await assert.rejects(access(new URL("../src/app/sales/page.tsx", import.meta.url)));
});

test("new mobile builds use the GXClosers identity and domain", async () => {
  const [manifest, gradle, api] = await Promise.all([
    source("apps/crm-mobile/app/src/main/AndroidManifest.xml"),
    source("apps/crm-mobile/app/build.gradle.kts"),
    source("apps/crm-mobile/app/src/main/java/com/gigxomi/gxclosers/data/ApiClient.kt"),
  ]);
  assert.match(manifest, /android:label="@string\/app_name"/);
  assert.match(manifest, /android:scheme="gxclosers"/);
  assert.match(gradle, /applicationId = "com\.gigxomi\.gxclosers"/);
  assert.match(gradle, /https:\/\/closers\.gigxomi\.com\/api/);
  assert.match(api, /BuildConfig\.GXCLOSERS_API_BASE/);
  assert.doesNotMatch(api, /www\.gigxomi\.com/);
  await assert.rejects(access(new URL("../apps/crm-mobile/eas.json", import.meta.url)));
  await assert.rejects(access(new URL("../apps/crm-mobile/package.json", import.meta.url)));
});

test("Sales APIs stay authenticated and tenant-scoped", async () => {
  const [roleGuard, mobileGuard, tenantResolver, whatsappRoute] = await Promise.all([
    source("src/lib/api/require-session-role.ts"),
    source("src/lib/api/require-sales-mobile-session.ts"),
    source("src/lib/api/resolve-session-tenant.ts"),
    source("src/app/api/sales/whatsapp/route.ts"),
  ]);
  assert.match(roleGuard, /requireSessionRole/);
  assert.match(mobileGuard, /SALES_AGENT/);
  assert.match(tenantResolver, /buildSalesWhatsAppTenantId/);
  assert.match(whatsappRoute, /resolveWhatsAppSetupTenantId/);
  assert.doesNotMatch(tenantResolver, /DEFAULT_TENANT/);
});

test("the extracted service does not expose public Meta webhooks", async () => {
  await access(new URL("../src/app/api/conversations/route.ts", import.meta.url));
  await access(new URL("../src/app/api/conversations/[id]/messages/route.ts", import.meta.url));
  await access(new URL("../src/app/api/meta/instagram/oauth/connect/route.ts", import.meta.url));
  await access(new URL("../src/app/api/meta/instagram/oauth/callback/route.ts", import.meta.url));
  await access(new URL("../src/app/api/meta/whatsapp/messages/route.ts", import.meta.url));
  await assert.rejects(access(new URL("../src/app/api/meta/whatsapp/webhook/route.ts", import.meta.url)));
  await assert.rejects(access(new URL("../src/app/api/meta/instagram/webhook/route.ts", import.meta.url)));
});

test("Closer inbound attachments stay human-safe", async () => {
  const [store, safety, chat] = await Promise.all([
    source("src/lib/gigxomi/dummy-platform-store.ts"),
    source("src/lib/gigxomi/closer-message-safety.ts"),
    source("src/components/chat/chat-workspace.tsx"),
  ]);
  assert.match(store, /buildInstagramMessageAttachments/);
  assert.match(store, /buildInboundAttachmentAcknowledgement/);
  assert.match(store, /if \(type !== "text" && type !== "button"/);
  assert.match(safety, /containsDevanagari/);
  assert.match(safety, /Roman Hinglish\/English/);
  assert.doesNotMatch(chat, /Ask the sender to resend it as a plain text message/);
  assert.doesNotMatch(chat, /\[Instagram attachment received\]/);
});

test("live conversations and Kanban use one lead stage record", async () => {
  const [salesStore, dashboard, statusRoute] = await Promise.all([
    source("src/lib/gigxomi/sales-store.ts"),
    source("src/components/sales/sales-dashboard.tsx"),
    source("src/app/api/conversations/[id]/lead-status/route.ts"),
  ]);
  assert.match(salesStore, /syncConversationLeadsIntoSales/);
  assert.match(salesStore, /conversationId: conversation\.id/);
  assert.match(salesStore, /mapConversationLeadStatusToSalesStage/);
  assert.match(dashboard, /aria-label=\{`Change \$\{lead\.customerName\} stage`\}/);
  assert.match(dashboard, /onStage=\{updateLeadStage\}/);
  assert.match(statusRoute, /syncLeadStatusToMetaAndOutbox/);
});
