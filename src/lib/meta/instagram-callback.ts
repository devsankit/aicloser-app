import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import {
  listInstagramConnectionStatesFromFile,
  updateInstagramConnectionStateFromFile,
} from "@/lib/gigxomi/dummy-platform-file-store";
import type { DummyInstagramConnectionState } from "@/lib/gigxomi/dummy-platform-store";

export type InstagramSignedRequestPayload = {
  algorithm?: string;
  app_id?: string | number;
  user_id?: string | number;
  issued_at?: string | number;
  [key: string]: unknown;
};

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="), "base64");
}

export function verifyInstagramSignedRequest(
  signedRequest: string,
  appSecret: string,
): InstagramSignedRequestPayload {
  const [encodedSignature, encodedPayload, ...extraParts] = signedRequest.split(".");
  if (!encodedSignature || !encodedPayload || extraParts.length > 0) {
    throw new Error("Malformed Instagram signed request.");
  }

  const payload = JSON.parse(decodeBase64Url(encodedPayload).toString("utf8")) as InstagramSignedRequestPayload;
  if (payload.algorithm && String(payload.algorithm).toUpperCase() !== "HMAC-SHA256") {
    throw new Error("Unsupported Instagram signed request algorithm.");
  }

  const actualSignature = decodeBase64Url(encodedSignature);
  const expectedSignature = createHmac("sha256", appSecret).update(encodedPayload).digest();
  if (
    actualSignature.length !== expectedSignature.length ||
    !timingSafeEqual(actualSignature, expectedSignature)
  ) {
    throw new Error("Invalid Instagram signed request signature.");
  }

  return payload;
}

export async function readInstagramSignedRequest(request: Request) {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (contentType.includes("application/json")) {
    const body = await request.json() as { signed_request?: unknown };
    return typeof body?.signed_request === "string" ? body.signed_request.trim() : "";
  }

  const form = await request.formData();
  const signedRequest = form.get("signed_request");
  return typeof signedRequest === "string" ? signedRequest.trim() : "";
}

export async function findInstagramConnectionForSignedRequest(payload: InstagramSignedRequestPayload) {
  const externalUserId = String(payload.user_id ?? "").trim();
  if (!externalUserId) return null;

  const configuredAppId = process.env.INSTAGRAM_OAUTH_CLIENT_ID?.trim();
  if (configuredAppId && payload.app_id && String(payload.app_id) !== configuredAppId) return null;

  const connections = await listInstagramConnectionStatesFromFile();
  return connections.find((connection) =>
    [connection.instagramBusinessAccountId, connection.accountId].some((id) => id && id === externalUserId),
  ) ?? null;
}

export async function disconnectInstagramConnection(connection: DummyInstagramConnectionState, reason: string) {
  return updateInstagramConnectionStateFromFile(connection.tenantId, {
    pluginEnabled: false,
    status: "Not connected",
    accessToken: "",
    lastError: reason,
    note: reason,
  });
}
