import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("workspace chat visibility is persisted with a restrictive default", async () => {
  const schema = await source("prisma/schema.prisma");
  const visibilityStore = await source("src/lib/api/sales-chat-visibility.ts");
  const route = await source("src/app/api/sales/chat-visibility/route.ts");

  assert.match(schema, /showOnlyAssignedChats\s+Boolean\s+@default\(true\)/);
  assert.match(visibilityStore, /DEFAULT_SHOW_ONLY_ASSIGNED_CHATS\s*=\s*true/);
  assert.match(visibilityStore, /prisma\.salesSettings\.upsert/);
  assert.match(route, /requireSessionRole\(\["SUPER_ADMIN", "ADMIN"\]\)/);
  assert.match(route, /saveShowOnlyAssignedChats/);
});

test("assigned-chat policy is enforced by list, stream, and direct conversation access", async () => {
  const listRoute = await source("src/app/api/conversations/route.ts");
  const eventsRoute = await source("src/app/api/conversations/events/route.ts");
  const access = await source("src/lib/api/conversation-access.ts");

  assert.match(listRoute, /getSalesAgentAssignedConversationIds/);
  assert.match(listRoute, /visibleConversations = visibleConversations\.filter/);
  assert.match(eventsRoute, /getSalesAgentAssignedConversationIds/);
  assert.match(eventsRoute, /resolveSessionTenantId\(authorization\.session\)/);
  assert.match(access, /showOnlyAssignedChatsForTenant/);
  assert.match(access, /if \(assignedOnly && !hasAssignedLead\)/);
  assert.doesNotMatch(access, /return hasAssignedLead \|\| isAuthorizedTenant/);
});

test("admin settings expose and save the assigned-chat visibility control", async () => {
  const panel = await source("src/components/sales/crm-settings-panel.tsx");

  assert.match(panel, /Show only assigned chats to sales users/);
  assert.match(panel, /\/api\/sales\/chat-visibility/);
  assert.match(panel, /showOnlyAssignedChats/);
  assert.match(panel, /Admins and managers keep workspace-wide visibility/);
});
