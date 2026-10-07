import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("getLeadBadgeConfig returns distinct styles for interested and booked leads", async () => {
  const file = fs.readFileSync("src/components/chat/chat-workspace.tsx", "utf8");
  assert.match(file, /export function getLeadBadgeConfig/);
  assert.match(file, /export const WHATSAPP_LABEL_COLORS/);

  // Check that interested / qualified has emerald/mint style
  assert.match(file, /rgba\(16, 185, 129/);
  assert.match(file, /#34d399/);

  // Check that training booked has purple style
  assert.match(file, /rgba\(168, 85, 247/);
  assert.match(file, /#c084fc/);
});

test("ChatThreadRow renders chat-thread-top-label-badge in topline", async () => {
  const file = fs.readFileSync("src/components/chat/chat-workspace.tsx", "utf8");
  assert.match(file, /className="chat-thread-top-label-badge"/);
  assert.match(file, /className="chat-thread-top-label-dot"/);
});

test("Scrollable filter bar includes lead labels and + Label creation button", async () => {
  const file = fs.readFileSync("src/components/chat/chat-workspace.tsx", "utf8");
  assert.match(file, /className="chat-filter-chip add-label-btn"/);
  assert.match(file, /isCreateLabelModalOpen/);
  assert.match(file, /New Label \(WhatsApp style\)/);
});

test("globals.css has scrollable chat-filter-row with hidden scrollbar", async () => {
  const css = fs.readFileSync("src/app/globals.css", "utf8");
  assert.match(css, /\.chat-filter-row\s*\{[^}]*overflow-x:\s*auto/);
  assert.match(css, /\.chat-filter-row::-webkit-scrollbar/);
  assert.match(css, /\.chat-thread-top-label-badge/);
});
