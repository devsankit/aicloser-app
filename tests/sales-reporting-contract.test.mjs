import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const reportsRoute = fs.readFileSync(new URL("../src/app/api/sales/reports/route.ts", import.meta.url), "utf8");
const reportingStore = fs.readFileSync(new URL("../src/lib/gigxomi/sales-reporting.ts", import.meta.url), "utf8");
const responsibilityUi = fs.readFileSync(new URL("../src/components/sales/responsibility-reporting.tsx", import.meta.url), "utf8");
const salesDashboard = fs.readFileSync(new URL("../src/components/sales/sales-dashboard.tsx", import.meta.url), "utf8");
const leadsRoute = fs.readFileSync(new URL("../src/app/api/sales/leads/route.ts", import.meta.url), "utf8");
const globalAiRoute = fs.readFileSync(new URL("../src/app/api/conversations/ai-auto-reply/global/route.ts", import.meta.url), "utf8");
const chatWorkspace = fs.readFileSync(new URL("../src/components/chat/chat-workspace.tsx", import.meta.url), "utf8");
const conversationsRoute = fs.readFileSync(new URL("../src/app/api/conversations/route.ts", import.meta.url), "utf8");
const conversationStore = fs.readFileSync(new URL("../src/lib/gigxomi/dummy-platform-store.ts", import.meta.url), "utf8");

test("responsibility reports expose live filters and scoped access", () => {
  assert.match(reportsRoute, /parseSalesReportFilters/);
  assert.match(reportsRoute, /SUPER_ADMIN.*ADMIN.*MANAGER.*SALES_AGENT/);
  assert.match(reportingStore, /range.*today.*7d.*30d.*custom.*all/);
  assert.match(reportingStore, /assignedAgentId: \{ in: agentIds/);
  assert.match(reportingStore, /metaConversionEvent\.findMany/);
  assert.match(reportingStore, /appAuthUser\.findMany/);
  assert.match(reportingStore, /attention.*due_today.*overdue.*untouched/);
  assert.match(reportingStore, /requested\.attention === "all"\s*\?\s*periodRows/);
  assert.match(reportingStore, /pagination: \{ page: requested\.page, pageSize: requested\.pageSize, total: audienceFilteredRows\.length/);
  assert.match(responsibilityUi, /attention, page: String\(page\)/);
  assert.match(responsibilityUi, /aria-pressed=\{active\}/);
  assert.match(responsibilityUi, /firstVisibleLead.*lastVisibleLead.*of/);
});

test("responsibility dashboard includes accountability and customer signals", () => {
  assert.match(responsibilityUi, /responsibility desk/i);
  assert.match(responsibilityUi, /Team accountability/);
  assert.match(responsibilityUi, /SIM.*Audio.*Paid/);
  assert.match(responsibilityUi, /CAPI/);
  assert.match(responsibilityUi, /Open WhatsApp/);
});

test("lead stage API enforces follow-up, loss reason, and payment evidence", () => {
  assert.doesNotMatch(leadsRoute, /Add a follow-up date or a short activity note/);
  assert.match(leadsRoute, /Add the reason before closing or recycling/);
  assert.match(leadsRoute, /Paid stage requires a confirmed successful payment/);
  assert.match(leadsRoute, /meta: lead\.metaSync/);
});

test("AI pause is scoped to the active conversation", () => {
  assert.match(globalAiRoute, /GET/);
  assert.match(globalAiRoute, /POST/);
  assert.match(globalAiRoute, /SUPER_ADMIN.*ADMIN.*MANAGER/);
  assert.match(globalAiRoute, /setGlobalAiAutoReplyEnabled/);
  assert.match(chatWorkspace, /handleToggleAiAutoReply/);
  assert.match(chatWorkspace, /activeConversation\.aiAutoReplyDisabled/);
  assert.doesNotMatch(chatWorkspace, /globalAiEnabled|AI all on|Emergency pause active|Global AI is paused/);
});

test("sales inbox can load the complete live conversation set", () => {
  assert.match(conversationsRoute, /searchParams\.get\("limit"\)/);
  assert.match(conversationStore, /audience === "sales" \? 1000/);
  assert.match(chatWorkspace, /limit: 1000/);
});
