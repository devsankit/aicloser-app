import "server-only";
import { encryptConnectedSecret, decryptConnectedSecret } from "@/lib/connected-platform/secret-box";
import type { DummyPlatformSnapshot } from "@/lib/gigxomi/dummy-platform-store";

const PREFIX = "encrypted-meta:v1:";
export function transformSnapshotSecrets(snapshot: DummyPlatformSnapshot, operation: "encrypt" | "decrypt"): DummyPlatformSnapshot {
  const transform = (value: string) => {
    if (!value) return value;
    if (operation === "encrypt") return value.startsWith(PREFIX) ? value : PREFIX + encryptConnectedSecret(value);
    return value.startsWith(PREFIX) ? decryptConnectedSecret(value.slice(PREFIX.length)) : value;
  };
  return {
    ...snapshot,
    whatsappStates: (snapshot.whatsappStates || []).map((state) => ({ ...state, accessToken: transform(state.accessToken), authorizationCode: "" })),
    instagramStates: (snapshot.instagramStates || []).map((state) => ({ ...state, accessToken: transform(state.accessToken) })),
  };
}
