export type ChatWorkspaceSyncPayload = {
  reason:
    | "assignment"
    | "permission"
    | "message"
    | "payment"
    | "lead-status"
    | "notes"
    | "new-chat"
    | "client-alias"
    | "refresh";
  conversationId?: string;
  senderId?: string;
  timestamp: number;
};

const CHAT_WORKSPACE_SYNC_CHANNEL = "gigxomi-chat-workspace-sync";
const CHAT_WORKSPACE_SYNC_STORAGE_KEY = "gigxomi-chat-workspace-sync";
const CHAT_WORKSPACE_SENDER_ID =
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `chat-sync-${Math.random().toString(36).slice(2)}`;

function buildPayload(
  payload: Omit<ChatWorkspaceSyncPayload, "timestamp">,
): ChatWorkspaceSyncPayload {
  return {
    ...payload,
    senderId: CHAT_WORKSPACE_SENDER_ID,
    timestamp: Date.now(),
  };
}

export function broadcastChatWorkspaceSync(
  payload: Omit<ChatWorkspaceSyncPayload, "timestamp">,
) {
  if (typeof window === "undefined") {
    return;
  }

  const message = buildPayload(payload);

  if ("BroadcastChannel" in window) {
    try {
      const channel = new BroadcastChannel(CHAT_WORKSPACE_SYNC_CHANNEL);
      channel.postMessage(message);
      channel.close();
    } catch {
      // BroadcastChannel is best-effort only.
    }
  }

  try {
    window.localStorage.setItem(
      CHAT_WORKSPACE_SYNC_STORAGE_KEY,
      JSON.stringify(message),
    );
  } catch {
    // Storage sync is also best-effort only.
  }
}

export function subscribeToChatWorkspaceSync(
  callback: (payload: ChatWorkspaceSyncPayload) => void,
) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  let channel: BroadcastChannel | null = null;

  if ("BroadcastChannel" in window) {
    try {
      channel = new BroadcastChannel(CHAT_WORKSPACE_SYNC_CHANNEL);
      channel.addEventListener("message", (event) => {
        const payload = event.data as ChatWorkspaceSyncPayload | undefined;
        if (payload?.timestamp && payload.senderId !== CHAT_WORKSPACE_SENDER_ID) {
          callback(payload);
        }
      });
    } catch {
      channel = null;
    }
  }

  const handleStorage = (event: StorageEvent) => {
    if (
      event.key !== CHAT_WORKSPACE_SYNC_STORAGE_KEY ||
      !event.newValue
    ) {
      return;
    }

    try {
      const payload = JSON.parse(
        event.newValue,
      ) as ChatWorkspaceSyncPayload;
      if (payload?.timestamp && payload.senderId !== CHAT_WORKSPACE_SENDER_ID) {
        callback(payload);
      }
    } catch {
      // Ignore malformed sync payloads.
    }
  };

  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener("storage", handleStorage);
    channel?.close();
  };
}
