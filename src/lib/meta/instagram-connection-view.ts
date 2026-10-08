import "server-only";
import { getInstagramConnectionStateFromFile } from "@/lib/gigxomi/dummy-platform-file-store";
import type { DummyInstagramConnectionState } from "@/lib/gigxomi/dummy-platform-store";

export function publicInstagramConnection(connection: DummyInstagramConnectionState | null) {
  if (!connection) return null;
  return {
    tenantId: connection.tenantId,
    pluginEnabled: connection.pluginEnabled,
    accountId: connection.accountId || connection.instagramBusinessAccountId,
    accountType: connection.accountType || "",
    appId: process.env.INSTAGRAM_OAUTH_CLIENT_ID || "",
    username: connection.username,
    status: connection.lastError ? "Needs attention" as const : connection.accessToken && connection.instagramBusinessAccountId ? "Connected" as const : "Not connected" as const,
    connectedAt: connection.connectedAt,
    expiresAt: connection.expiresAt,
    scopes: connection.scopes || [],
    lastError: connection.lastError || "",
    updatedAt: connection.updatedAt,
  };
}

export async function getInstagramConnectionView(tenantId: string) {
  return publicInstagramConnection(await getInstagramConnectionStateFromFile(tenantId));
}
