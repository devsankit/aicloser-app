import crypto from "node:crypto";

export const META_GRAPH_API_VERSION = process.env.META_GRAPH_API_VERSION?.trim() || "v22.0";
export const META_GRAPH_BASE_URL = `https://graph.facebook.com/${META_GRAPH_API_VERSION}`;
export const REQUESTED_BUSINESS_PHONE = "9993328124";

// Rate limiting & dispatch safeguards
export const DEFAULT_DISPATCH_RATE_PER_SECOND = 20;
export const MAX_RETRY_ATTEMPTS = 3;
export const RETRY_BASE_DELAY_MS = 1000;
export const MAX_PREVIEW_LIMIT = 20;

/**
 * Returns whether WhatsApp Marketing runs in local dry-run / mock mode.
 * When true, no real Meta API calls are made and no real WhatsApp messages are dispatched.
 */
export function isMockMode(): boolean {
  if (process.env.WHATSAPP_MARKETING_MODE === "live") return false;
  return (
    process.env.WHATSAPP_MARKETING_MODE === "mock" ||
    process.env.NODE_ENV === "test" ||
    process.env.NODE_ENV !== "production" ||
    process.env.NEXT_PUBLIC_WHATSAPP_MARKETING_MODE === "mock" ||
    process.env.NODE_TEST_CONTEXT !== undefined
  );
}

/**
 * Resolves Meta App ID with fallback to legacy aliases.
 */
export function getMetaAppId(): string {
  return (
    process.env.META_APP_ID?.trim() ||
    process.env.META_WHATSAPP_APP_ID?.trim() ||
    ""
  );
}

/**
 * Resolves Meta App Secret with fallback to legacy aliases.
 */
export function getMetaAppSecret(): string {
  return (
    process.env.META_APP_SECRET?.trim() ||
    process.env.GIGXOMI_META_APP_SECRET?.trim() ||
    process.env.FACEBOOK_APP_SECRET?.trim() ||
    ""
  );
}

/**
 * Resolves Dedicated Webhook Verification Token.
 * Note: Does NOT allow META_WHATSAPP_CONFIG_ID.
 */
export function getMetaWebhookVerifyToken(): string {
  const token =
    process.env.META_WHATSAPP_VERIFY_TOKEN?.trim() ||
    process.env.META_WEBHOOK_VERIFY_TOKEN?.trim();
  if (token) return token;
  if (isMockMode()) return "gigxomi_whatsapp_marketing_token";
  return "";
}

/**
 * Resolves Bootstrap credentials (used only for initial setup / local testing).
 */
export function getBootstrapConfig() {
  return {
    accessToken: process.env.META_WHATSAPP_ACCESS_TOKEN?.trim() || "",
    wabaId: process.env.META_WHATSAPP_BUSINESS_ACCOUNT_ID?.trim() || "",
    phoneNumberId: process.env.META_WHATSAPP_PHONE_NUMBER_ID?.trim() || "",
    verifyToken: getMetaWebhookVerifyToken(),
  };
}

/**
 * Derives a 32-byte AES key from configuration.
 * In production: strictly enforces WHATSAPP_TOKEN_ENCRYPTION_SECRET to prevent weak fallback.
 * In development / test: falls back safely to SESSION_SECRET or test key.
 */
export function getEncryptionKey(): Buffer {
  const isProduction = process.env.NODE_ENV === "production";
  const explicitSecret = process.env.WHATSAPP_TOKEN_ENCRYPTION_SECRET?.trim();

  if (isProduction) {
    if (!explicitSecret || explicitSecret.length < 16) {
      throw new Error(
        "FATAL: WHATSAPP_TOKEN_ENCRYPTION_SECRET is required in production and must be at least 16 characters long.",
      );
    }
    return crypto.createHash("sha256").update(explicitSecret).digest();
  }

  const devSecret =
    explicitSecret ||
    process.env.SESSION_SECRET?.trim() ||
    process.env.META_APP_SECRET?.trim() ||
    "gxclosers-local-dev-fallback-encryption-key-32b";

  return crypto.createHash("sha256").update(devSecret).digest();
}

/**
 * Encrypt sensitive tokens (e.g. Meta system user / access tokens) at rest using AES-256-GCM.
 */
export function encryptSecureToken(plainText: string): string {
  if (!plainText) return "";
  try {
    const iv = crypto.randomBytes(12);
    const key = getEncryptionKey();
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    let encrypted = cipher.update(plainText, "utf8", "hex");
    encrypted += cipher.final("hex");
    const authTag = cipher.getAuthTag().toString("hex");
    return `${iv.toString("hex")}:${authTag}:${encrypted}`;
  } catch (error) {
    if (process.env.NODE_ENV === "production") {
      throw error;
    }
    console.error("Token encryption failed:", error);
    return plainText;
  }
}

/**
 * Decrypt sensitive tokens stored at rest.
 */
export function decryptSecureToken(encryptedText: string): string {
  if (!encryptedText) return "";
  if (!encryptedText.includes(":")) {
    return encryptedText; // Legacy or plain text in local dev
  }
  try {
    const [ivHex, authTagHex, encryptedPayload] = encryptedText.split(":");
    if (!ivHex || !authTagHex || !encryptedPayload) return encryptedText;
    const key = getEncryptionKey();
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
    let decrypted = decipher.update(encryptedPayload, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (error) {
    if (process.env.NODE_ENV === "production") {
      throw error;
    }
    return encryptedText;
  }
}
