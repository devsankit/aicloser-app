import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("ChatSidebarHeader includes topTabs prop and renders it above search input", () => {
  const file = fs.readFileSync("src/components/chat/chat-workspace.tsx", "utf8");
  assert.match(file, /topTabs\?:\s*ReactNode/);
  assert.match(file, /\{topTabs\s*\?\s*<div className="chat-top-tabs-container">\{topTabs\}<\/div>\s*:\s*null\}/);
});

test("ChatWorkspace defines channelCounts and channelTopTabs with All, WhatsApp API, and WhatsApp Personal", () => {
  const file = fs.readFileSync("src/components/chat/chat-workspace.tsx", "utf8");
  assert.match(file, /const channelCounts = useMemo/);
  assert.match(file, /isPersonal = c\.externalSourceType === "whatsapp_personal" \|\| c\.externalSourceType === "whatsapp_business"/);
  assert.match(file, /const channelTopTabs = \(/);
  assert.match(file, /className=\{cx\("chat-top-channel-tab", channelFilter === "all" && "active"\)\}/);
  assert.match(file, /className=\{cx\("chat-top-channel-tab tab-company", channelFilter === "whatsapp_company" && "active"\)\}/);
  assert.match(file, /className=\{cx\("chat-top-channel-tab tab-personal", channelFilter === "whatsapp_connected" && "active"\)\}/);
  assert.match(file, /<span>WhatsApp API<\/span>/);
  assert.match(file, /<span>WhatsApp Personal<\/span>/);
});

test("Top tabs are passed to ChatSidebarHeader in both empty and populated views", () => {
  const file = fs.readFileSync("src/components/chat/chat-workspace.tsx", "utf8");
  const matches = file.match(/topTabs=\{channelTopTabs\}/g);
  assert.ok(matches && matches.length >= 2, "topTabs={channelTopTabs} must be passed in both empty and normal sidebar renders");
});

test("ChatThreadRow and Stage Header display consistent WhatsApp Personal vs WhatsApp API badges", () => {
  const file = fs.readFileSync("src/components/chat/chat-workspace.tsx", "utf8");
  assert.match(file, /"WhatsApp Personal" : "WhatsApp API"/);
  assert.match(file, /className="chat-source-chip personal-wa"/);
  assert.match(file, /className="chat-source-chip company-wa"/);
});

test("Admin and Manager sessions resolve to sales audience when viewing CRM chat", () => {
  const access = fs.readFileSync("src/lib/api/conversation-access.ts", "utf8");
  assert.match(access, /session\.role === "ADMIN"/);
  assert.match(access, /requestedAudience === "sales" \? \("sales" as const\) : \("admin" as const\)/);
  assert.match(access, /requestedAudience === "sales" \? \("sales" as const\) : \("manager" as const\)/);
});

test("Chat filter row is unified and de-cluttered with clean Stages selector", () => {
  const file = fs.readFileSync("src/components/chat/chat-workspace.tsx", "utf8");
  assert.match(file, /const filterRowElement = \(/);
  assert.match(file, /filterRow=\{filterRowElement\}/);
});

test("globals.css contains styles and light mode overrides for top channel tabs and stage menu", () => {
  const css = fs.readFileSync("src/app/globals.css", "utf8");
  assert.match(css, /\.chat-top-channel-tabs/);
  assert.match(css, /\.chat-top-channel-tab/);
  assert.match(css, /\.chat-top-channel-tab\.tab-company\.active/);
  assert.match(css, /\.chat-top-channel-tab\.tab-personal\.active/);
  assert.match(css, /\.chat-top-tab-badge/);
  assert.match(css, /\.chat-stage-menu-popover/);
  assert.match(css, /html:not\(\.dark\)\s*\.chat-top-channel-tabs/);
});
