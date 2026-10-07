import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

test("chat notes endpoint exists and authorizes sales agents", () => {
  const notesRoutePath = path.join(root, "src/app/api/conversations/[id]/notes/route.ts");
  assert.ok(fs.existsSync(notesRoutePath), "notes route must exist");
  const content = fs.readFileSync(notesRoutePath, "utf8");
  assert.ok(content.includes("SALES_AGENT"), "notes route must authorize SALES_AGENT");
  assert.ok(content.includes("updateConversationInternalNotesFromFile"), "must call updateConversationInternalNotesFromFile");
});

test("chat lead-status endpoint authorizes sales agents", () => {
  const leadStatusRoutePath = path.join(root, "src/app/api/conversations/[id]/lead-status/route.ts");
  assert.ok(fs.existsSync(leadStatusRoutePath), "lead-status route must exist");
  const content = fs.readFileSync(leadStatusRoutePath, "utf8");
  assert.ok(content.includes("SALES_AGENT"), "lead-status route must authorize SALES_AGENT");
});

test("dummy platform file store exports notes updater", () => {
  const fileStorePath = path.join(root, "src/lib/gigxomi/dummy-platform-file-store.ts");
  const content = fs.readFileSync(fileStorePath, "utf8");
  assert.ok(content.includes("export function updateConversationInternalNotesFromFile"), "must export updateConversationInternalNotesFromFile");
});

test("chat workspace renders status and notes for sales audience", () => {
  const chatWorkspacePath = path.join(root, "src/components/chat/chat-workspace.tsx");
  const content = fs.readFileSync(chatWorkspacePath, "utf8");
  assert.ok(content.includes("renderNotesPopover"), "must include renderNotesPopover");
  assert.ok(content.includes("handleSaveNotes"), "must include handleSaveNotes");
  assert.ok(content.includes('audience === "sales"'), "must include audience === sales in toolbar");
  assert.ok(content.includes("chat-status-pill"), "must include status badge pill");
});
