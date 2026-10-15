import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("Kanban board has explicit height bounds and prominent scrollbars in globals.css", () => {
  const css = fs.readFileSync("src/app/globals.css", "utf8");
  assert.match(css, /body \.sales-theme-scope \.sales-crm-surface\s*\{[^}]*overflow-x:\s*auto !important/);
  assert.match(css, /body \.sales-theme-scope \.sales-crm-surface\s*\{[^}]*height:\s*calc\(100vh - 280px\) !important/);
  assert.match(css, /body \.sales-theme-scope \.sales-crm-surface::-webkit-scrollbar/);
  assert.match(css, /body \.sales-theme-scope \.sales-crm-surface::-webkit-scrollbar-thumb/);
  assert.match(css, /body \.sales-theme-scope \.sales-kanban\s*\{[^}]*grid-template-columns:\s*repeat\(7,\s*330px\)/);
  assert.match(css, /body \.sales-theme-scope \.sales-kanban-column\s*\{[^}]*overflow-y:\s*auto !important/);
});

test("Sales dashboard includes stage jump and horizontal scroll helpers", () => {
  const file = fs.readFileSync("src/components/sales/sales-dashboard.tsx", "utf8");
  assert.match(file, /All 7 pipeline stages • Scroll horizontally or click any stage above to jump/);
  assert.match(file, /scrollBy\(\{\s*left:\s*340/);
  assert.match(file, /scrollIntoView\(\{\s*behavior:\s*"smooth"/);
});

test("Contacts API supports lead assignment and exposes workspace agents", () => {
  const file = fs.readFileSync("src/app/api/sales/contacts/route.ts", "utf8");
  assert.match(file, /reassignSalesLead/);
  assert.match(file, /action === "assign"/);
  assert.match(file, /assignedAgentId: lead\.assignedAgentId/);
  assert.match(file, /agents:\s*activeAgents/);
});

test("Contacts hub includes in-row rep assignment and bulk assignment", () => {
  const file = fs.readFileSync("src/components/sales/contacts-hub.tsx", "utf8");
  assert.match(file, /handleAssignSingleContact/);
  assert.match(file, /handleBulkAssign/);
  assert.match(file, /Assign \(\{selectedIds\.size\}\) to Closer\.\.\./);
  assert.match(file, /Assign \$\{contact\.name\} to closer/);
});

test("Conversations route maps real CRM lead stages to conversation status", () => {
  const file = fs.readFileSync("src/app/api/conversations/route.ts", "utf8");
  assert.match(file, /stageToConvStatus/);
  assert.match(file, /INTERESTED:\s*\{\s*id:\s*"qualified",\s*label:\s*"Interested \/ Qualified"/);
  assert.match(file, /effectiveStatus \? effectiveStatus\.label/);
});

test("Chat workspace permanently displays phone numbers and respects lead stage", () => {
  const file = fs.readFileSync("src/components/chat/chat-workspace.tsx", "utf8");
  assert.match(file, /chat-thread-phone-display/);
  assert.match(file, /<Phone size=\{10\}/);
  assert.match(file, /<Phone size=\{12\}/);
  assert.match(file, /activeCustomerPhone/);
  assert.match(file, /stageMapping/);
});

test("WhatsApp button on Kanban card and table routes to chat with Company/Closer Business WhatsApp for API leads", () => {
  const file = fs.readFileSync("src/components/sales/sales-dashboard.tsx", "utf8");
  assert.match(file, /onOpenChat=\{openLeadChat\}/);
  assert.match(file, /isLeadFromApi\(lead\.source\)/);
  assert.match(file, /Company WA/);
  assert.match(file, /Closer Business WA/);
  assert.match(file, /onOpenChat\(lead\.id,\s*"company"\)/);
  assert.match(file, /onOpenChat\(lead\.id,\s*"connected_user"\)/);
});

test("Lead notes API queries all timeline notes and LeadDetailForm uses single unified LeadNotesManager with phone sync", () => {
  const apiFile = fs.readFileSync("src/app/api/sales/leads/[leadId]/notes/route.ts", "utf8");
  assert.doesNotMatch(apiFile, /type:\s*\{\s*in:\s*\["NOTE"/, "Notes GET must not restrict timeline entries to a subset of types");
  assert.match(apiFile, /where:\s*\{\s*leadId\s*\}/);

  const dashboardFile = fs.readFileSync("src/components/sales/sales-dashboard.tsx", "utf8");
  assert.doesNotMatch(dashboardFile, /className="sales-note-composer"/, "Duplicate sales-note-composer must be removed in favor of unified LeadNotesManager");
  assert.match(dashboardFile, /setNotesRevision/);
  assert.match(dashboardFile, /refreshTrigger=\{notesRevision\}/);
  assert.match(dashboardFile, /onTimelineNoteUpdated/);

  const mobileStoreFile = fs.readFileSync("src/lib/gigxomi/sales-mobile-store.ts", "utf8");
  assert.match(mobileStoreFile, /salesLeadTimelineEntry\.create/);
  assert.match(mobileStoreFile, /source:\s*"mobile-app-sim"/);

  const notesManager = fs.readFileSync("src/components/sales/lead-notes-manager.tsx", "utf8");
  assert.match(notesManager, /refreshTrigger\s*=\s*0/);
  assert.match(notesManager, /Phone Sync Active/);
  assert.match(notesManager, /useEffect\(\(\)\s*=>\s*\{[\s\S]*void loadNotes\(\);[\s\S]*\}\s*,\s*\[leadId,\s*refreshTrigger\]\)/);
});
