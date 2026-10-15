import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("Audit Contract: Strict agent chat isolation prevents personal WhatsApp data leaks", async () => {
  const route = await source("src/app/api/conversations/route.ts");
  const visibility = await source("src/lib/api/sales-chat-visibility.ts");

  // Verified fix: getSalesAgentAssignedScope is imported and used
  assert.match(route, /getSalesAgentAssignedScope/);
  assert.match(visibility, /export async function getSalesAgentAssignedScope/);

  // Must not blindly allow any personal or business WhatsApp to all sales agents
  assert.doesNotMatch(
    route,
    /conversation\.externalSourceType === "whatsapp_personal" \|\| conversation\.externalSourceType === "whatsapp_business"\)/,
    "Personal and business WhatsApp chats must not be universally accessible to unassigned reps",
  );

  // Strict ownership check: only show personal WhatsApp if connected phone matches agent
  assert.match(route, /agentScope\.connectedPhone && sourcePhone && agentScope\.connectedPhone === sourcePhone/);
  // Supports admin/manager inspection of specific agent's inbox
  assert.match(route, /requestedAgentId && requestedAgentId !== "all"/);
});

test("Audit Contract: Lead import enforces tenant-wide database deduplication", async () => {
  const importRoute = await source("src/app/api/sales/leads/import/route.ts");

  // Query prisma across the full tenant instead of relying on scoped in-memory visible leads
  assert.match(importRoute, /prisma\.salesLeadAssignment\.findMany\(\s*\{\s*where:\s*\{\s*tenantId:\s*tenantScopeId\s*\}/);
  assert.match(importRoute, /prisma\.salesLeadPoolItem\.findMany\(\s*\{\s*where:\s*\{\s*tenantId:\s*tenantScopeId\s*\}/);
  assert.match(importRoute, /seen\.add\(key\)/);
});

test("Audit Contract: 1-Click Call buttons are active in Kanban card, details modal, and chat header", async () => {
  const dashboard = await source("src/components/sales/sales-dashboard.tsx");
  const chat = await source("src/components/chat/chat-workspace.tsx");

  // Kanban card has direct call link
  assert.match(dashboard, /href=\{`tel:\$\{lead\.customerPhone\.replace\(\/\[\^\\d\+\]\/g, ""\)\}`\}/);
  assert.match(dashboard, /<PhoneCall size=\{12\} \/> Call/);

  // Lead details modal has Call Customer button
  assert.match(dashboard, /<PhoneCall size=\{13\} \/> Call Customer/);

  // Chat workspace header has interactive dialer link
  assert.match(chat, /crm-header-dialer-action/);
  assert.match(chat, /href=\{`tel:\$\{activeConversation\.customerPhone\.replace\(\/\[\^\\d\+\]\/g, ""\)\}`\}/);
});

test("Audit Contract: Interactive Sheet view provides spreadsheet grid with sticky columns", async () => {
  const dashboard = await source("src/components/sales/sales-dashboard.tsx");

  assert.match(dashboard, /sales-crm-sheet-container/);
  assert.match(dashboard, /sales-crm-sheet-table/);
  assert.match(dashboard, /<th[^>]*>Lead \/ Contact<\/th>/);
  assert.match(dashboard, /<th[^>]*>Phone<\/th>/);
  assert.match(dashboard, /<th[^>]*>Stage<\/th>/);
  assert.match(dashboard, /<th[^>]*>Actions<\/th>/);
  assert.match(dashboard, /position: "sticky", left: 0/);
});

test("Audit Contract: Call reports route supports pagination, date filters, and total counts", async () => {
  const callRoute = await source("src/app/api/sales/call-reports/route.ts");

  assert.match(callRoute, /const page = Math\.max\(1/);
  assert.match(callRoute, /const pageSize = Math\.min\(500/);
  assert.match(callRoute, /skip/);
  assert.match(callRoute, /take: pageSize/);
  assert.match(callRoute, /totalPages: Math\.ceil\(totalCalls \/ pageSize\)/);
});
