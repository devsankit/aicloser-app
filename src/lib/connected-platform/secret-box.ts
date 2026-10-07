import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function getKey() {
  const secret = process.env.CONNECTED_PLATFORM_TOKEN_ENCRYPTION_KEY?.trim();
  if (!secret) throw new Error("CONNECTED_PLATFORM_TOKEN_ENCRYPTION_KEY is required for connected account tokens.");
  return createHash("sha256").update(secret).digest();
}
export function encryptConnectedSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptConnectedSecret(value: string) {
  const [ivValue, tagValue, payloadValue] = value.split(".");
  if (!ivValue || !tagValue || !payloadValue) throw new Error("Connected account token has an invalid format.");
  const decipher = createDecipheriv("aes-256-gcm", getKey(), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(payloadValue, "base64url")), decipher.final()]).toString("utf8");
}
