import "server-only";

import { cookies } from "next/headers";

const CENTRAL_API_BASE = (
  process.env.AICLOSER_API_URL?.trim() ||
  process.env.NEXT_PUBLIC_AICLOSER_API_URL?.trim() ||
  "https://api.aicloser.in/api/v1"
).replace(/\/$/, "");

export class CentralApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "CentralApiError";
    this.status = status;
  }
}

export async function centralApiRequest<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const cookieStore = await cookies();
  const token = cookieStore.get("aicloser_token")?.value?.trim() || cookieStore.get("gx_session")?.value?.trim();
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  // A few server-side callers pass plain objects as `body`. The Fetch API
  // accepts strings/FormData/etc., not raw objects; normalize JSON bodies here
  // so assignment, stage, and settings requests cannot silently fail with a
  // malformed payload.
  const rawBody = init.body as unknown;
  const isStructuredBody = rawBody && typeof rawBody === "object" &&
    (typeof FormData === "undefined" || !(rawBody instanceof FormData)) &&
    (typeof URLSearchParams === "undefined" || !(rawBody instanceof URLSearchParams)) &&
    (typeof Blob === "undefined" || !(rawBody instanceof Blob)) &&
    !(rawBody instanceof ArrayBuffer) &&
    !ArrayBuffer.isView(rawBody);
  const body = isStructuredBody ? JSON.stringify(rawBody) : init.body;

  const response = await fetch(`${CENTRAL_API_BASE}${path.startsWith("/") ? path : `/${path}`}`, {
    ...init,
    body,
    headers,
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.success === false) {
    const error = payload?.error || payload?.message || `Central API request failed (${response.status})`;
    throw new CentralApiError(String(error), response.status);
  }
  return payload as T;
}

export function centralApiBaseUrl() {
  return CENTRAL_API_BASE;
}
