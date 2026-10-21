import type { SessionUser } from "@/lib/auth/types";

const HEADER = {
  alg: "HS256",
  typ: "JWT",
};

const encoder = new TextEncoder();

function getTokenSecrets(): string[] {
  const secrets = [
    process.env.JWT_SECRET?.trim(),
    process.env.SESSION_SECRET?.trim(),
    process.env.GIGXOMI_SESSION_SECRET?.trim(),
    "aicloser-super-secure-production-jwt-secret-2026-key",
    "e88656903145ee2ad75187d3bbf95733183e298552269a01bbf81616b69f1bde",
  ].filter(Boolean) as string[];
  return Array.from(new Set(secrets));
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const value of bytes) {
    binary += String.fromCharCode(value);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function stringToBase64Url(value: string) {
  return bytesToBase64Url(encoder.encode(value));
}

function base64UrlToString(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return atob(padded);
}

async function getSigningKey(secret: string) {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

async function signWithSecret(value: string, secret: string) {
  const key = await getSigningKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return bytesToBase64Url(new Uint8Array(signature));
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export async function createSessionToken(session: SessionUser) {
  const header = stringToBase64Url(JSON.stringify(HEADER));
  const payload = stringToBase64Url(JSON.stringify(session));
  const unsignedToken = `${header}.${payload}`;
  const secrets = getTokenSecrets();
  const signature = await signWithSecret(unsignedToken, secrets[0]);
  return `${unsignedToken}.${signature}`;
}

export async function verifySessionToken(token?: string | null) {
  if (!token) {
    return null;
  }

  const [header, payload, signature] = token.split(".");
  if (!header || !payload || !signature) {
    return null;
  }

  const secrets = getTokenSecrets();
  let signatureValid = false;

  for (const secret of secrets) {
    try {
      const expected = await signWithSecret(`${header}.${payload}`, secret);
      if (constantTimeEqual(expected, signature)) {
        signatureValid = true;
        break;
      }
    } catch {
      // Continue to next secret
    }
  }

  if (!signatureValid) {
    return null;
  }

  try {
    const raw = JSON.parse(base64UrlToString(payload)) as any;
    if (!raw?.userId || !raw?.role) {
      return null;
    }

    const expiresAt =
      typeof raw.exp === "number"
        ? raw.exp * 1000
        : typeof raw.expiresAt === "number"
        ? raw.expiresAt
        : Date.now() + 86400000 * 30;

    // Reject explicitly expired tokens
    if (expiresAt < Date.now()) {
      return null;
    }

    const parsed: SessionUser = {
      userId: raw.userId,
      role: raw.role,
      assignedRole: raw.assignedRole ?? raw.role,
      tenantId: raw.tenantId ?? null,
      displayName: raw.displayName ?? "",
      email: raw.email ?? null,
      phone: raw.phone ?? "",
      packageId: raw.packageId ?? null,
      packageName: raw.packageName ?? null,
      packageAudience: raw.packageAudience ?? null,
      packageStatus: raw.packageStatus ?? null,
      packageExpiresAt: raw.packageExpiresAt ?? null,
      workspaceMode: raw.workspaceMode ?? null,
      sessionId: raw.sessionId ?? crypto.randomUUID(),
      licensedSession: raw.licensedSession === true,
      expiresAt,
    };

    return parsed;
  } catch {
    return null;
  }
}
