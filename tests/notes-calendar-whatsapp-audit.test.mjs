import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

test("Audit Contract: Conversation notes route synchronously updates platform file store", () => {
  const notesRoutePath = path.join(ROOT, "src/app/api/conversations/[id]/notes/route.ts");
  const content = fs.readFileSync(notesRoutePath, "utf8");

  // Must call updateConversationInternalNotesFromFile
  assert.ok(
    content.includes("updateConversationInternalNotesFromFile(id, notes, nextFollowUpAt)"),
    "POST /api/conversations/[id]/notes must call updateConversationInternalNotesFromFile to update file store cache",
  );

  // Must return guaranteedView with internalNotes
  assert.ok(
    content.includes("internalNotes: persistedNotes"),
    "POST /api/conversations/[id]/notes must guarantee internalNotes is returned in the conversation view payload",
  );
});

test("Audit Contract: Calendar popover does not force relative expansion inside cards and uses fixed high-z-index overlay", () => {
  const cssPath = path.join(ROOT, "src/app/globals.css");
  const css = fs.readFileSync(cssPath, "utf8");

  // Must not have position: relative !important on sales-calendar-popover inside sales-crm-card
  const relativeCardRegex = /body\s+\.sales-theme-scope\s+\.sales-crm-card\s+\.sales-calendar-popover\s*\{[^}]*position:\s*relative\s*!important/i;
  assert.ok(
    !relativeCardRegex.test(css),
    "globals.css must NOT enforce position: relative !important on .sales-calendar-popover inside .sales-crm-card",
  );

  // Must have position: fixed !important with z-index: 99999
  assert.ok(
    css.includes("body .sales-theme-scope .sales-calendar-popover") && css.includes("z-index: 99999 !important"),
    "globals.css must specify fixed overlay with z-index: 99999 for .sales-calendar-popover",
  );

  // Dashboard component must use createPortal for LeadFollowUpPicker
  const dashboardPath = path.join(ROOT, "src/components/sales/sales-dashboard.tsx");
  const dashboard = fs.readFileSync(dashboardPath, "utf8");
  assert.ok(
    dashboard.includes("createPortal(") && dashboard.includes('className="sales-calendar-popover"'),
    "LeadFollowUpPicker must render sales-calendar-popover into document.body using createPortal",
  );
});

test("Audit Contract: Unified Lead Notes - No duplicate textarea in lead details modal", () => {
  const dashboardPath = path.join(ROOT, "src/components/sales/sales-dashboard.tsx");
  const dashboard = fs.readFileSync(dashboardPath, "utf8");

  // Must include LeadNotesManager
  assert.ok(
    dashboard.includes("<LeadNotesManager"),
    "LeadDetailModal must render LeadNotesManager",
  );

  // Must not include duplicate <textarea defaultValue={lead.notes} name="notes" placeholder="Notes" />
  assert.ok(
    !dashboard.includes('<textarea defaultValue={lead.notes} name="notes" placeholder="Notes" />'),
    "Lead profile edit form must NOT contain duplicate notes textarea",
  );
});

test("Audit Contract: Company WA vs Closer Business WA internal sync in CRM card, list, and chat workspace", () => {
  const dashboardPath = path.join(ROOT, "src/components/sales/sales-dashboard.tsx");
  const dashboard = fs.readFileSync(dashboardPath, "utf8");

  // In CrmCard, list row, and detail modal, WhatsApp must NOT kick user out to external wa.me
  assert.ok(
    !dashboard.includes('window.open(`https://wa.me/'),
    "CRM card and list view must NOT kick user to external https://wa.me/ new tab",
  );

  // Must call openLeadChat with connected_user and company transports
  assert.ok(
    dashboard.includes('openLeadChat(lead.id, "connected_user")'),
    "Closer Business WA button must invoke openLeadChat with connected_user transport",
  );
  assert.ok(
    dashboard.includes('openLeadChat(lead.id, "company")'),
    "Company WA button must invoke openLeadChat with company transport",
  );

  // In CrmCard, must call onOpenChat with connected_user and company transports
  assert.ok(
    dashboard.includes('onOpenChat(lead.id, "connected_user")'),
    "CrmCard must invoke onOpenChat with connected_user transport",
  );
  assert.ok(
    dashboard.includes('onOpenChat(lead.id, "company")'),
    "CrmCard must invoke onOpenChat with company transport",
  );

  // ChatWorkspace must support dedicated channel filters
  const chatWorkspacePath = path.join(ROOT, "src/components/chat/chat-workspace.tsx");
  const chatWorkspace = fs.readFileSync(chatWorkspacePath, "utf8");
  assert.ok(
    chatWorkspace.includes('"whatsapp_company"') && chatWorkspace.includes('"whatsapp_connected"'),
    "ChatWorkspace must support dedicated whatsapp_company and whatsapp_connected filter channels",
  );

  // isLeadFromApi must include webhook, zapier, meta, facebook
  assert.ok(
    dashboard.includes('s.includes("meta")') && dashboard.includes('s.includes("facebook")'),
    "isLeadFromApi must recognize meta and facebook lead sources",
  );
});
